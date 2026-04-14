from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from sqlmodel import select

from app.models.user import User, UserRrhhLink
from app.models.vacation import RequestStatus, VacationRequest
from app.services.audit import log_action
from app.utils.email import send_vacation_status_notification, send_vacation_notification
from app.services.notification import create_notification, NotificationType


async def get_pending_manager_requests(
    session: AsyncSession,
    manager_id: str
) -> list[VacationRequest]:
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
) -> list[VacationRequest]:
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
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest | None:
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
    request.manager_approved_at = datetime.now(timezone.utc)
    
    # Check if RRHH has already approved
    if request.rrhh_approved_by:
        request.status = RequestStatus.ACCEPTED
    
    # Audit Log
    await log_action(
        session=session,
        user_id=manager_uuid,
        action="APPROVE_MANAGER",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "changes": {"status": {"old": old_status, "new": request.status}}
        },
        ip_address=ip_address
    )
    
    await session.commit()
    await session.refresh(request)
    
    # Email Notification
    try:
        employee = await session.get(User, request.user_id)
        manager = await session.get(User, manager_uuid)
        if employee and manager:
            status_text = "Aprobada por Responsable" if request.status == RequestStatus.APPROVED_MANAGER else "Aprobada"
            await send_vacation_status_notification(
                email_to=employee.email,
                status=status_text,
                manager_name=f"{manager.first_name} {manager.last_name}",
                request=fastapi_request
            )
            
            # In-App Notification
            await create_notification(
                session=session,
                user_id=request.user_id,
                title="Solicitud Actualizada",
                message=f"Tu solicitud de {request.request_type} ha sido {status_text.lower()}.",
                notif_type=NotificationType.VACATION_APPROVED,
                link=f"/vacations?id={request.id}",
                metadata_payload={"request_id": str(request.id), "status": request.status}
            )
            if request.status == RequestStatus.APPROVED_MANAGER:
                rrhh_email = None
                if request.assigned_rrhh_id:
                    rrhh_user = await session.get(User, request.assigned_rrhh_id)
                    if rrhh_user: rrhh_email = rrhh_user.email
                else:
                    stmt = select(User).join(UserRrhhLink, User.id == UserRrhhLink.rrhh_id).where(UserRrhhLink.user_id == request.user_id)
                    rrhh_user = (await session.execute(stmt)).scalars().first()
                    if rrhh_user: rrhh_email = rrhh_user.email
                if rrhh_email:
                    await send_vacation_notification(
                        email_to=rrhh_email,
                        requester_name=f"{employee.first_name} {employee.last_name}",
                        start_date=request.start_date.strftime("%d/%m/%Y"),
                        end_date=request.end_date.strftime("%d/%m/%Y") if request.end_date else None,
                        days=request.days_requested,
                        type=request.request_type,
                        request=fastapi_request
                    )
    except Exception:
        pass

    return request


async def reject_by_manager(
    session: AsyncSession,
    request_id: str,
    manager_id: str,
    reason: str,
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest | None:
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
    request.manager_approved_at = datetime.now(timezone.utc)
    request.rejection_reason = reason
    
    # Audit Log
    await log_action(
        session=session,
        user_id=manager_uuid,
        action="REJECT_MANAGER",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "reason": reason,
            "changes": {"status": {"old": old_status, "new": request.status}}
        },
        ip_address=ip_address
    )

    await session.commit()
    await session.refresh(request)
    
    # Email Notification
    try:
        employee = await session.get(User, request.user_id)
        manager = await session.get(User, manager_uuid)
        if employee and manager:
            await send_vacation_status_notification(
                email_to=employee.email,
                status="Rechazada",
                manager_name=f"{manager.first_name} {manager.last_name}",
                reason=reason,
                request=fastapi_request
            )
            
            # In-App Notification
            await create_notification(
                session=session,
                user_id=request.user_id,
                title="Solicitud Rechazada",
                message=f"Tu solicitud de {request.request_type} ha sido rechazada por tu responsable.",
                notif_type=NotificationType.VACATION_REJECTED,
                link=f"/vacations?id={request.id}",
                metadata_payload={"request_id": str(request.id), "reason": reason}
            )
    except Exception:
        pass

    return request


async def approve_by_rrhh(
    session: AsyncSession,
    request_id: str,
    rrhh_id: str,
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest | None:
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
        # Check link
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
    request.rrhh_approved_at = datetime.now(timezone.utc)
    
    if request.manager_approved_by:
        request.status = RequestStatus.ACCEPTED
    
    # Audit Log
    await log_action(
        session=session,
        user_id=rrhh_uuid,
        action="APPROVE_RRHH",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "changes": {"status": {"old": old_status, "new": request.status}}
        },
        ip_address=ip_address
    )
    
    await session.commit()
    await session.refresh(request)
    
    # Email Notification
    try:
        employee = await session.get(User, request.user_id)
        rrhh = await session.get(User, rrhh_uuid)
        if employee and rrhh:
            status_text = "Aprobada" if request.status == RequestStatus.ACCEPTED else "Aprobada por RRHH"
            await send_vacation_status_notification(
                email_to=employee.email,
                status=status_text,
                manager_name=f"{rrhh.first_name} {rrhh.last_name}",
                request=fastapi_request
            )
    except Exception:
        pass

    return request


async def reject_by_rrhh(
    session: AsyncSession,
    request_id: str,
    rrhh_id: str,
    reason: str,
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest | None:
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
        # Check link
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
    request.rrhh_approved_at = datetime.now(timezone.utc)
    request.rejection_reason = reason
    
    # Audit Log
    await log_action(
        session=session,
        user_id=rrhh_uuid,
        action="REJECT_RRHH",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "requester_id": str(request.user_id),
            "reason": reason,
            "changes": {"status": {"old": old_status, "new": request.status}}
        },
        ip_address=ip_address
    )
    
    await session.commit()
    await session.refresh(request)
    
    # Email Notification
    try:
        employee = await session.get(User, request.user_id)
        rrhh = await session.get(User, rrhh_uuid)
        if employee and rrhh:
            await send_vacation_status_notification(
                email_to=employee.email,
                status="Rechazada",
                manager_name=f"{rrhh.first_name} {rrhh.last_name}",
                reason=reason,
                request=fastapi_request
            )
    except Exception:
        pass

    return request
