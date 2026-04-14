from datetime import date, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import User, UserRrhhLink
from app.models.vacation import (
    RequestStatus,
    VacationAttachment,
    VacationRequest,
    VacationRequestCreate,
)
from app.services.audit import log_action
from app.utils.email import send_vacation_notification
from app.services.vacation.balance import get_vacation_balance
from app.services.vacation.validator import VacationValidator
from app.utils.business_days import get_business_days_count
from app.utils.duration import parse_duration
from app.services.notification import create_notification, NotificationType


async def _notify_new_request(session: AsyncSession, request: VacationRequest, fastapi_request: Request | None = None):
    """Notify manager and/or RRHH about a new vacation request"""
    try:
        employee = await session.get(User, request.user_id)
        if not employee: return

        # Target Emails
        targets = []
        if request.assigned_manager_id:
            manager = await session.get(User, request.assigned_manager_id)
            if manager: targets.append(manager.email)
        
        if request.assigned_rrhh_id:
            rrhh = await session.get(User, request.assigned_rrhh_id)
            if rrhh: targets.append(rrhh.email)
        elif not targets:
            # Fallback to linked RRHH if no manager assigned
            stmt = select(User).join(UserRrhhLink, User.id == UserRrhhLink.rrhh_id).where(UserRrhhLink.user_id == request.user_id)
            rrhh_users = (await session.execute(stmt)).scalars().all()
            for u in rrhh_users: targets.append(u.email)

        for email in set(targets):
            await send_vacation_notification(
                email_to=email,
                requester_name=f"{employee.first_name} {employee.last_name}",
                start_date=request.start_date.strftime("%d/%m/%Y"),
                end_date=request.end_date.strftime("%d/%m/%Y") if request.end_date else None,
                days=request.days_requested,
                type=request.request_type,
                request=fastapi_request
            )
        
        # In-App Notifications
        notif_msg = f"{employee.full_name} ha solicitado un permiso de {request.request_type} para el {request.start_date.strftime('%d/%m/%Y')}."
        # Notify Manager
        if request.assigned_manager_id:
             await create_notification(
                 session=session,
                 user_id=request.assigned_manager_id,
                 title="Nueva Solicitud de Ausencia",
                 message=notif_msg,
                 notif_type=NotificationType.VACATION_REQUEST,
                 link=f"/vacations?id={request.id}",
                 metadata_payload={"request_id": str(request.id)}
             )
        # Notify RRHH
        if request.assigned_rrhh_id:
             await create_notification(
                 session=session,
                 user_id=request.assigned_rrhh_id,
                 title="Nueva Solicitud de Ausencia",
                 message=notif_msg,
                 notif_type=NotificationType.VACATION_REQUEST,
                 link=f"/vacations?id={request.id}",
                 metadata_payload={"request_id": str(request.id)}
             )

    except Exception:
        import logging
        logging.getLogger(__name__).error("Failed to send vacation notification", exc_info=True)


async def get_user_vacation_requests(
    session: AsyncSession,
    user_id: str
) -> list[VacationRequest]:
    """Get all vacation requests for a user"""
    user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    result = await session.execute(
        select(VacationRequest)
        .where(VacationRequest.user_id == user_uuid)
        # .options(selectinload(VacationRequest.attachments))
        .order_by(VacationRequest.created_at.desc())
    )
    return list(result.scalars().all())

async def _calculate_days(session: AsyncSession, user_id: str, request_data: VacationRequestCreate) -> float:
    """Helper to calculate final days requested based on hours or dates"""
    # Quick check for pure float input without calculation
    is_hours = isinstance(request_data.days_requested, str) and ":" in request_data.days_requested
    
    if not is_hours and not request_data.end_date:
        # Simple single day or pre-calculated float
        try:
            return float(request_data.days_requested)
        except (ValueError, TypeError):
            return 0.0

    # Needed for hours calculation
    balance = await get_vacation_balance(session, user_id)
    daily_work_hours = balance.daily_work_hours or 8.0
    
    if is_hours:
        hours = parse_duration(request_data.days_requested)
        return hours / daily_work_hours
    
    # Date range calculation
    b_days = 0
    if request_data.end_date:
        b_days = await get_business_days_count(
            session, 
            request_data.start_date.date(), 
            request_data.end_date.date()
        )
    
    try:
        input_days = float(request_data.days_requested)
        # Trust input if it deviates intentionally (e.g. half days) unless it matches business days logic
        if request_data.request_type == "maternidad_paternidad":
            return input_days
        elif request_data.end_date:
             # If input is basically 0 or matches calc, use calc. Else trust input validation? 
             # Logic from old code:
             return b_days if input_days <= 0 or abs(input_days - b_days) > 0.01 else input_days
        else:
             return input_days
    except (ValueError, TypeError):
        return b_days

async def create_vacation_request(
    session: AsyncSession,
    user_id: str,
    request_data: VacationRequestCreate,
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest:
    """Create a new vacation request"""
    user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    
    # 1. Calculate Days
    final_days = await _calculate_days(session, str(user_uuid), request_data)

    # 2. Validate
    validator = VacationValidator(session, str(user_uuid))
    await validator.validate_create_request(request_data, final_days)

    # 3. Create Entity
    assigned_manager_uuid = UUID(request_data.assigned_manager_id) if request_data.assigned_manager_id else None
    assigned_rrhh_uuid = UUID(request_data.assigned_rrhh_id) if request_data.assigned_rrhh_id else None
    
    # NEW: Logic to determine request_type from policy
    from app.models.permission_policy import PermissionPolicy
    policy_uuid = UUID(request_data.policy_id) if request_data.policy_id else None
    policy = await session.get(PermissionPolicy, policy_uuid) if policy_uuid else None
    
    effective_req_type = request_data.request_type
    if policy:
        effective_req_type = policy.slug

    # Auto-resolve Validators if not provided
    if not assigned_manager_uuid or not assigned_rrhh_uuid:
        from app.models.user import User, UserManagerLink, UserRrhhLink
        employee = await session.get(User, user_uuid)
        if employee:
            if not assigned_manager_uuid:
                # Try Managers Link first
                stmt = select(User).join(UserManagerLink, User.id == UserManagerLink.manager_id).where(UserManagerLink.user_id == user_uuid)
                m = (await session.execute(stmt)).scalars().first()
                if m: assigned_manager_uuid = m.id
                elif employee.parent_id: assigned_manager_uuid = employee.parent_id
            
            if not assigned_rrhh_uuid:
                stmt = select(User).join(UserRrhhLink, User.id == UserRrhhLink.rrhh_id).where(UserRrhhLink.user_id == user_uuid)
                r = (await session.execute(stmt)).scalars().first()
                if r: assigned_rrhh_uuid = r.id

    request = VacationRequest(
        user_id=user_uuid,
        request_type=effective_req_type,
        policy_id=policy_uuid,
        leave_type_id=request_data.leave_type_id if effective_req_type == "permisos" else None,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
        days_requested=final_days,
        assigned_manager_id=assigned_manager_uuid,
        assigned_rrhh_id=assigned_rrhh_uuid,
        status=request_data.status or RequestStatus.PENDING, 
        description=request_data.description,
        causal_date=request_data.causal_date,
        child_name=request_data.child_name,
        child_birthdate=request_data.child_birthdate,
        telework_percentage=request_data.telework_percentage
    )
    session.add(request)
    await session.commit()
    await session.refresh(request)
    
    # 4. Process Attachments
    if request_data.attachments:
        for attachment_data in request_data.attachments:
            attachment = VacationAttachment(
                request_id=request.id,
                file_url=attachment_data.get("file_url"),
                file_original_name=attachment_data.get("file_original_name")
            )
            session.add(attachment)
        await session.commit() # Commit attachments
        
    # 5. Audit Log
    await log_action(
        session=session,
        user_id=user_uuid,
        action="CREATE",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "type": request.request_type,
            "days": request.days_requested,
            "status": request.status
        },
        ip_address=ip_address
    )
    
    # 6. Email Notification
    if request.status == RequestStatus.PENDING:
        await _notify_new_request(session, request, fastapi_request)

    return request


async def update_vacation_request(
    session: AsyncSession,
    request_id: str,
    request_data: VacationRequestCreate,
    current_user_id: str,
    ip_address: str | None = None
) -> VacationRequest:
    """Update an existing vacation request"""
    # Fetch existing request
    stmt = select(VacationRequest).where(VacationRequest.id == request_id)
    result = await session.execute(stmt)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if str(request.user_id) != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this request")
        
    # 1. Calculate new Days
    final_days = await _calculate_days(session, current_user_id, request_data)

    # 2. Validate
    validator = VacationValidator(session, current_user_id)
    await validator.validate_update_request(request, request_data, final_days)
    
    # Capture old state for diffing
    old_state_dict = request.model_dump()
        
    # Apply updates
    request.request_type = request_data.request_type
    request.leave_type_id = request_data.leave_type_id if request_data.request_type == "permisos" else None
    request.start_date = request_data.start_date
    request.end_date = request_data.end_date
    request.days_requested = final_days
    request.description = request_data.description
    
    if request_data.assigned_manager_id:
        request.assigned_manager_id = UUID(request_data.assigned_manager_id)
    
    if request_data.assigned_rrhh_id:
        request.assigned_rrhh_id = UUID(request_data.assigned_rrhh_id)
    
    # Update dynamic fields
    request.causal_date = request_data.causal_date
    request.child_name = request_data.child_name
    request.child_birthdate = request_data.child_birthdate
    request.telework_percentage = request_data.telework_percentage
    
    if request_data.policy_id:
        request.policy_id = UUID(request_data.policy_id)
        # We don't usually change request_type on update but if policy changed, it might.
        from app.models.policy import PermissionPolicy
        pol = await session.get(PermissionPolicy, request.policy_id)
        if pol: request.request_type = pol.slug
        
    # Handle Attachments
    attachments_updated = False
    if request_data.attachments is not None:
        attachments_updated = True
        await session.execute(text("DELETE FROM vacation_attachments WHERE request_id = :req_id").bindparams(req_id=request.id))
        for attachment_data in request_data.attachments:
            attachment = VacationAttachment(
                request_id=request.id,
                file_url=attachment_data.get("file_url"),
                file_original_name=attachment_data.get("file_original_name")
            )
            session.add(attachment)
            
    # Audit Log
    from app.services.audit import generate_diff, log_action
    new_state_dict = request.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)

    if attachments_updated:
        diffs['attachments'] = {"old": "...", "new": "Updated"}

    if diffs:
        await log_action(
            session=session,
            user_id=UUID(current_user_id),
            action="UPDATE",
            module="VACACIONES",
            details={
                "request_id": str(request.id),
                "request_type": request.request_type,
                "changes": diffs
            },
            ip_address=ip_address
        )
            
    session.add(request)
    await session.commit()
    await session.refresh(request)
    
    # Reload
    stmt = select(VacationRequest).where(VacationRequest.id == request.id) # .options(selectinload(VacationRequest.attachments))
    result = await session.execute(stmt)
    return result.scalar_one()


async def submit_vacation_request(
    session: AsyncSession,
    request_id: str,
    ip_address: str | None = None,
    fastapi_request: Request | None = None
) -> VacationRequest | None:
    """Submit a vacation request (change status from borrador to pending)"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    stmt = select(VacationRequest).where(VacationRequest.id == request_uuid)
    result = await session.execute(stmt)
    request = result.scalar_one_or_none()
    
    if not request or request.status != RequestStatus.BORRADOR:
        return None
    
    # Validation logic (uses dummy create data to validate rules)
    # Ideally should construct a VacationRequestCreate from current request, but partial check is fine.
    # We validate specifically balance availability here.
    
    validator = VacationValidator(session, str(request.user_id))
    # We need to simulate 'sending' data. 
    # Actually, simpler: just validate availability directly. 
    # But validator expects Create object. 
    # Let's perform validation manually or adapt validator?
    # Adaptation: validator._validate_balance_availability needs request_type and status (which will be Pending).
    
    # Validate Balance Rules
    # Re-use validator internal methods if public or create ad-hoc check?
    # Let's construct a dummy object for validation to reuse logic dry.
    dummy_data = VacationRequestCreate(
        request_type=request.request_type,
        start_date=request.start_date,
        days_requested=request.days_requested,
        status=RequestStatus.PENDING # Simulate pending to trigger checks
    )
    await validator.validate_create_request(dummy_data, request.days_requested)

    old_status = request.status
    request.status = RequestStatus.PENDING
    await session.commit()
    await session.refresh(request)
    
    # Audit Log
    await log_action(
        session=session,
        user_id=request.user_id,
        action="UPDATE",
        module="VACACIONES",
        details={
            "request_id": str(request.id),
            "action": "SUBMIT",
            "changes": {"status": {"old": old_status, "new": RequestStatus.PENDING}}
        },
        ip_address=ip_address
    )
    
    # Email Notification
    await _notify_new_request(session, request, fastapi_request)

    return request
async def delete_vacation_request(
    session: AsyncSession,
    request_id: str,
    user_id: str,
    ip_address: str | None = None
) -> bool:
    """Delete a vacation request and its attachments"""
    request_uuid = UUID(request_id) if isinstance(request_id, str) else request_id
    stmt = select(VacationRequest).where(VacationRequest.id == request_uuid)
    result = await session.execute(stmt)
    request = result.scalar_one_or_none()
    
    if not request:
        return False
        
    # Capture snapshot
    snapshot = request.model_dump()
    snapshot['id'] = str(snapshot['id'])
    
    # Delete folder
    from app.utils.file_ops import delete_entity_folders
    await delete_entity_folders("vacations", str(request_id))
    
    # Audit Log
    await log_action(
        session=session,
        user_id=UUID(user_id),
        action="DELETE",
        module="VACACIONES",
        details={
            "request_id": str(request_id),
            "full_snapshot": snapshot
        },
        ip_address=ip_address
    )
    
    await session.delete(request)
    await session.commit()
    return True
