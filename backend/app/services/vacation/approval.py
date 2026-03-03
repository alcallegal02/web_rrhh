from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.models.vacation import VacationRequest, RequestStatus
from app.models.user import User, UserRrhhLink
from app.services.audit import log_action

async def get_pending_manager_requests(
    session: AsyncSession,
    manager_id: str
) -> List[VacationRequest]:
    """Get pending requests assigned to a manager"""
    # Convert manager_id string to UUID
    manager_uuid = UUID(manager_id) if isinstance(manager_id, str) else manager_id
    result = await session.execute(
        select(VacationRequest)
        .where(
            VacationRequest.assigned_manager_id == manager_uuid,
            VacationRequest.status == RequestStatus.PENDING.value
        )
        .order_by(VacationRequest.created_at.desc())
    )
    return list(result.scalars().all())


async def get_pending_rrhh_requests(
    session: AsyncSession,
    rrhh_id: str
) -> List[VacationRequest]:
    """Get pending requests assigned to a RRHH user"""
    # Convert rrhh_id string to UUID
    rrhh_uuid = UUID(rrhh_id) if isinstance(rrhh_id, str) else rrhh_id
    
    stmt = (
        select(VacationRequest)
        .join(User, VacationRequest.user_id == User.id)
        .outerjoin(UserRrhhLink, User.id == UserRrhhLink.user_id)
        .where(
            VacationRequest.status.in_([RequestStatus.PENDING.value, RequestStatus.APPROVED_MANAGER.value]),
            ((VacationRequest.assigned_rrhh_id == rrhh_uuid) | 
             ((VacationRequest.assigned_rrhh_id == None) & (UserRrhhLink.rrhh_id == rrhh_uuid)))
        )
        .order_by(VacationRequest.created_at.desc())
        .distinct() 
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def approve_by_manager(
    session: AsyncSession,
    request_id: str,
    manager_id: str,
    ip_address: Optional[str] = None
) -> Optional[VacationRequest]:
    """Approve a vacation request by manager"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    manager_uuid = UUID(manager_id) if isinstance(manager_id, str) else manager_id
    result = await session.execute(
        select(VacationRequest).where(VacationRequest.id == request_uuid)
    )
    request = result.scalar_one_or_none()
    
    if not request or request.status != RequestStatus.PENDING:
        return None
    
    if request.assigned_manager_id != manager_uuid:
        return None
    
    old_status = request.status
    request.status = RequestStatus.APPROVED_MANAGER
    request.manager_approved_by = manager_uuid
    request.manager_approved_at = datetime.utcnow()
    
    # Check if RRHH has already approved
    if request.rrhh_approved_by:
        request.status = RequestStatus.ACCEPTED
    
    await session.commit()
    await session.refresh(request)
    
    # Audit Log
    await log_action(
        session=session,
        user_id=manager_uuid,
        action="APPROVE_MANAGER",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "new_status": request.status
        },
        ip_address=ip_address
    )
    
    return request


async def reject_by_manager(
    session: AsyncSession,
    request_id: str,
    manager_id: str,
    reason: str,
    ip_address: Optional[str] = None
) -> Optional[VacationRequest]:
    """Reject a vacation request by manager"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    manager_uuid = UUID(manager_id) if isinstance(manager_id, str) else manager_id
    result = await session.execute(
        select(VacationRequest).where(VacationRequest.id == request_uuid)
    )
    request = result.scalar_one_or_none()
    
    if not request or request.status != RequestStatus.PENDING:
        return None
    
    if request.assigned_manager_id != manager_uuid:
        return None
    
    old_status = request.status
    request.status = RequestStatus.REJECTED
    request.manager_approved_by = manager_uuid
    request.manager_approved_at = datetime.utcnow()
    request.rejection_reason = reason
    
    await session.commit()
    await session.refresh(request)
    
    # Audit Log
    await log_action(
        session=session,
        user_id=manager_uuid,
        action="REJECT_MANAGER",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "reason": reason
        },
        ip_address=ip_address
    )

    return request


async def approve_by_rrhh(
    session: AsyncSession,
    request_id: str,
    rrhh_id: str,
    ip_address: Optional[str] = None
) -> Optional[VacationRequest]:
    """Approve a vacation request by RRHH (final approval)"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    rrhh_uuid = UUID(rrhh_id) if isinstance(rrhh_id, str) else rrhh_id
    result = await session.execute(
        select(VacationRequest).where(VacationRequest.id == request_uuid)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        return None
    
    if request.status not in [RequestStatus.PENDING, RequestStatus.APPROVED_MANAGER]:
        return None
    
    if request.assigned_rrhh_id:
        if request.assigned_rrhh_id != rrhh_uuid:
            return None
    else:
        link_result = await session.execute(
            select(UserRrhhLink).where(
                UserRrhhLink.user_id == request.user_id,
                UserRrhhLink.rrhh_id == rrhh_uuid
            )
        )
        if not link_result.first():
             return None

    request.assigned_rrhh_id = rrhh_uuid
    
    old_status = request.status
    request.status = RequestStatus.APPROVED_RRHH
    request.rrhh_approved_by = rrhh_uuid
    request.rrhh_approved_at = datetime.utcnow()
    
    if request.manager_approved_by:
        request.status = RequestStatus.ACCEPTED
    
    await session.commit()
    await session.refresh(request)
    
    # Audit Log
    await log_action(
        session=session,
        user_id=rrhh_uuid,
        action="APPROVE_RRHH",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "new_status": request.status
        },
        ip_address=ip_address
    )
    
    return request


async def reject_by_rrhh(
    session: AsyncSession,
    request_id: str,
    rrhh_id: str,
    reason: str,
    ip_address: Optional[str] = None
) -> Optional[VacationRequest]:
    """Reject a vacation request by RRHH"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    rrhh_uuid = UUID(rrhh_id) if isinstance(rrhh_id, str) else rrhh_id
    result = await session.execute(
        select(VacationRequest).where(VacationRequest.id == request_uuid)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        return None
    
    if request.status not in [RequestStatus.PENDING, RequestStatus.APPROVED_MANAGER]:
        return None
    
    if request.assigned_rrhh_id:
        if request.assigned_rrhh_id != rrhh_uuid:
            return None
    else:
        link_result = await session.execute(
            select(UserRrhhLink).where(
                UserRrhhLink.user_id == request.user_id,
                UserRrhhLink.rrhh_id == rrhh_uuid
            )
        )
        if not link_result.first():
             return None

    request.assigned_rrhh_id = rrhh_uuid
    
    old_status = request.status
    request.status = RequestStatus.REJECTED
    request.rrhh_approved_by = rrhh_uuid
    request.rrhh_approved_at = datetime.utcnow()
    request.rejection_reason = reason
    
    await session.commit()
    await session.refresh(request)
    
    # Audit Log
    await log_action(
        session=session,
        user_id=rrhh_uuid,
        action="REJECT_RRHH",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "reason": reason
        },
        ip_address=ip_address
    )
    
    return request
