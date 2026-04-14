from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.balance_dynamic import VacationBalanceResponse
from app.models.user import (
    User,
    UserResponse,
    UserRole,
)
from app.models.vacation import (
    RequestStatus,
    VacationRequest,
    VacationRequestCreate,
    VacationRequestResponse,
)
from app.routers.auth import get_current_user
from app.services.vacation import (
    approve_by_manager,
    approve_by_rrhh,
    create_vacation_request,
    delete_vacation_request,
    get_available_responsibles_for_user,
    get_pending_manager_requests,
    get_pending_rrhh_requests,
    get_user_vacation_requests,
    get_vacation_balance,
    reject_by_manager,
    reject_by_rrhh,
    submit_vacation_request,
    update_vacation_request,
)

router = APIRouter(tags=["vacation"])


def _map_request_response(req: VacationRequest) -> VacationRequestResponse:
    """Map loaded VacationRequest to Response efficienty"""
    # Create dict manually to handle UUID -> str conversion
    req_dict = req.model_dump()
    
    # Manually convert UUIDs to strings for response
    req_dict['id'] = str(req_dict['id'])
    req_dict['user_id'] = str(req_dict['user_id'])
    
    keys_to_convert = ['assigned_manager_id', 'assigned_rrhh_id', 'manager_approved_by', 'rrhh_approved_by', 'leave_type_id']
    for k in keys_to_convert:
        if req_dict.get(k):
            req_dict[k] = str(req_dict[k])
    
    # Eager loaded fields access (no DB query)
    if req.user:
        req_dict['user_name'] = req.user.full_name
        
    if req.assigned_manager:
        req_dict['assigned_manager_name'] = req.assigned_manager.full_name
        
    if req.assigned_rrhh:
        req_dict['assigned_rrhh_name'] = req.assigned_rrhh.full_name
        
    if req.attachments:
        req_dict['attachments'] = [
            {'id': str(a.id), 'file_url': a.file_url, 'file_original_name': a.file_original_name, 'created_at': a.created_at} 
            for a in req.attachments
        ]
    else:
        req_dict['attachments'] = []
        
    # Handle Date/Dynamic fields serialization
    for f in ['causal_date', 'child_birthdate']:
        if req_dict.get(f) and isinstance(req_dict[f], (date, datetime)):
            req_dict[f] = req_dict[f].isoformat()

    return VacationRequestResponse.model_validate(req_dict)


@router.post("", response_model=VacationRequestResponse)
async def create_request(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_data: VacationRequestCreate
    ):
    """Create a new vacation request (as draft)"""
    new_request = await create_vacation_request(session, str(current_user.id), request_data, ip_address=request.client.host, fastapi_request=request)
    return _map_request_response(new_request)


@router.get("/managed", response_model=list[VacationRequestResponse])
async def get_managed_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    status_filter: RequestStatus | None = None
):
    """Get vacation requests that require the current user's approval"""
    stmt = select(VacationRequest).where(
        or_(
            VacationRequest.assigned_manager_id == current_user.id,
            VacationRequest.assigned_rrhh_id == current_user.id
        )
    )
    if status_filter:
        stmt = stmt.where(VacationRequest.status == status_filter)
    else:
        stmt = stmt.where(VacationRequest.status != RequestStatus.BORRADOR)
        
    stmt = stmt.order_by(VacationRequest.created_at.desc())
    result = await session.execute(stmt)
    requests = result.scalars().all()
    
    return [_map_request_response(r) for r in requests]


@router.get("/stats/managed")
async def get_managed_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get statistics for requests managed by the current user"""
    stmt = select(VacationRequest).where(
        or_(
            VacationRequest.assigned_manager_id == current_user.id,
            VacationRequest.assigned_rrhh_id == current_user.id
        )
    )
    result = await session.execute(stmt)
    requests = result.scalars().all()
    
    stats = {
        "total": len(requests),
        "pending": len([r for r in requests if r.status == RequestStatus.PENDIENTE]),
        "approved": len([r for r in requests if r.status == RequestStatus.APROBADO]),
        "rejected": len([r for r in requests if r.status == RequestStatus.RECHAZADO]),
    }
    return stats


@router.put("/{request_id}", response_model=VacationRequestResponse)
async def update_request(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str,
    request_data: VacationRequestCreate
    ):
    """Update a vacation request (draft only)"""
    updated_request = await update_vacation_request(session, request_id, request_data, str(current_user.id), ip_address=request.client.host)
    return _map_request_response(updated_request)


@router.post("/{request_id}/submit", response_model=VacationRequestResponse)
async def submit_request(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str
):
    """Submit a vacation request (change status from borrador to pending)"""
    result = await submit_vacation_request(session, request_id, ip_address=request.client.host, fastapi_request=request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be submitted"
        )
    return _map_request_response(result)


@router.get("/my-requests", response_model=list[VacationRequestResponse])
async def get_my_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get current user's vacation requests"""
    requests = await get_user_vacation_requests(session, str(current_user.id))
    return [_map_request_response(req) for req in requests]


@router.get("/balance", response_model=VacationBalanceResponse)
async def get_balance(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get vacation balance for current user"""
    balance = await get_vacation_balance(session, str(current_user.id))
    return balance


@router.get("/pending-manager", response_model=list[VacationRequestResponse])
async def get_pending_for_manager(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get pending requests for manager approval"""
    requests = await get_pending_manager_requests(session, str(current_user.id))
    return [_map_request_response(req) for req in requests]


@router.post("/{request_id}/approve-manager")
async def approve_request_manager(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str
):
    """Approve a vacation request as manager"""
    result = await approve_by_manager(session, request_id, str(current_user.id), ip_address=request.client.host, fastapi_request=request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be approved"
        )
    return _map_request_response(result)


@router.post("/{request_id}/reject-manager")
async def reject_request_manager(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str,
    reason: Annotated[str, Form()]
):
    """Reject a vacation request as manager"""
    result = await reject_by_manager(session, request_id, str(current_user.id), reason, ip_address=request.client.host, fastapi_request=request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be rejected"
        )
    return _map_request_response(result)


@router.get("/pending-rrhh", response_model=list[VacationRequestResponse])
async def get_pending_for_rrhh(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get pending requests for RRHH approval"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN] and not current_user.can_manage_holidays:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can access this endpoint"
        )
    
    requests = await get_pending_rrhh_requests(session, str(current_user.id))
    return [_map_request_response(req) for req in requests]


@router.post("/{request_id}/approve-rrhh")
async def approve_request_rrhh(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str
):
    """Approve a vacation request as RRHH (final approval)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN] and not current_user.can_manage_holidays:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can approve requests"
        )
    
    result = await approve_by_rrhh(session, request_id, str(current_user.id), ip_address=request.client.host, fastapi_request=request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be approved"
        )
    return _map_request_response(result)


@router.post("/{request_id}/reject-rrhh")
async def reject_request_rrhh(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str,
    reason: Annotated[str, Form()]
):
    """Reject a vacation request as RRHH"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN] and not current_user.can_manage_holidays:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can reject requests"
        )
    
    result = await reject_by_rrhh(session, request_id, str(current_user.id), reason, ip_address=request.client.host, fastapi_request=request)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be rejected"
        )
    return _map_request_response(result)


@router.delete("/{request_id}")
async def delete_request(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request_id: str
):
    """Delete a vacation request (draft only or admin/superadmin)"""
    # Logic: users can only delete their own BORRADOR requests.
    # RRHH/Superadmin can delete any? 
    # For now, let's keep it simple: own draft or authorized roles.
    
    # We load it first to check status/ownership
    requests = await get_user_vacation_requests(session, str(current_user.id))
    # This is inefficient, but we don't have get_by_id exposed in router?
    # Actually, let's just call the service and let it handle auth or add it here.
    
    deleted = await delete_vacation_request(session, request_id, str(current_user.id), ip_address=request.client.host)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or cannot be deleted"
        )
        
    return {"message": "Request deleted successfully"}


@router.get("/available-responsibles", response_model=list[UserResponse])
async def get_available_responsibles(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get list of your assigned managers and RRHH users"""
    return await get_available_responsibles_for_user(session, str(current_user.id))

