from typing import Annotated
import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional
from uuid import UUID

import aiofiles
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models.complaint import (
    Complaint,
    ComplaintCreate,
    ComplaintCreateResponse,
    ComplaintResponse,
    ComplaintStatus,
)
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.services.complaint import (
    create_complaint,
    delete_complaint,
    get_all_complaints,
    get_complaint_by_code,
    update_complaint_status,
    verify_complaint_access,
)
from app.utils.brute_force import security_manager
from app.utils.email import send_credentials_email

router = APIRouter(tags=["complaint"])

# Rate limiter - will be set from app.state in main.py
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


@router.post("/", response_model=ComplaintCreateResponse)
@limiter.limit("5/minute")
async def create_complaint_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_session)],
    title: str = Form(...),
    description: str = Form(...),
    email: str | None = Form(None),
    files: list[UploadFile] = File(default=[])
):
    """Create a new anonymous complaint (public endpoint)"""
    from app.services.complaint import process_and_save_complaint_files

    # Process files via service (this handles validation, quota, conversion, saving)
    attachments = []
    if files:
         attachments = await process_and_save_complaint_files(files, session, request.client.host)
            
    complaint_data = ComplaintCreate(
        title=title,
        description=description,
        attachments=attachments if attachments else None
    )
    
    try:
        complaint = await create_complaint(session, complaint_data)
        # Service now handles full reload with attachments

        # 4. If email is provided, send credentials (non-blocking)
        if email:
            background_tasks.add_task(send_credentials_email, email, complaint.code, complaint.access_token)

        # 5. Notify Admins/RRHH with notification preference active
        from app.utils.email import send_complaint_notification
        from sqlmodel import select, or_, and_
        
        # Get users to notify: 
        # (Is Superadmin OR (Is RRHH AND can_manage_complaints)) AND notif_complaints is True
        stmt = select(User).where(
            and_(
                User.is_active == True,
                User.notif_complaints == True,
                or_(
                    User.role == UserRole.SUPERADMIN.value,
                    and_(
                        User.role == UserRole.RRHH.value,
                        User.can_manage_complaints == True
                    )
                )
            )
        )
        result = await session.execute(stmt)
        users_to_notify = result.scalars().all()
        
        for admin_user in users_to_notify:
            background_tasks.add_task(send_complaint_notification, admin_user.email, complaint.code, complaint.title)

        # Broadcast create event
        from app.websocket.manager import websocket_manager
        # Prepare public safe data (Admin view needs it all, public view limited)
        # Broadcast full data to admins? WebSocket broadcast goes to ALL. 
        # For security, we should filter or only send ID. 
        # But for this MVP request, let's send minimal notification.
        # "New Complaint Created"
        await websocket_manager.broadcast({
            "type": "COMPLAINT_CREATED",
            "data": { "id": str(complaint.id), "title": complaint.title, "status": complaint.status }
        })

        # AUDIT LOG (Anonymous) - EXPLICITLY REMOVED TO PRESERVE ANONYMITY AND MATCH SERVICE

        return complaint
    except Exception as e:
        logger.error(f"Error creating complaint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al procesar la denuncia: {str(e)}"
        )


@router.get("/{code}", response_model=ComplaintResponse)
@limiter.limit("5/minute")
async def get_complaint(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_session)],
    code: str,
    token: Annotated[str, Query(description="Access token/Security key")]
):
    """Get complaint status by code and token (public endpoint)"""
    client_ip = request.client.host
    # Potential check for X-Forwarded-For if behind proxy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0]

    complaint = await verify_complaint_access(session, code, token)
    if not complaint:
        logger.info(f"Access denied for IP {client_ip} on code {code}")
        # Artificial delay to prevent brute-force (kept as extra layer)
        await asyncio.sleep(1)
        
        # Track failed attempt
        if security_manager.track_failed_attempt(client_ip, code):
            logger.info(f"IP {client_ip} just reached the threshold and is now BLOCKED.")
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Demasiados intentos fallidos. Su IP ha sido bloqueada durante {settings.BRUTE_FORCE_BLOCK_MINUTES} minutos."
            )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Denuncia no encontrada o clave incorrecta."
        )
    
    # Success: Reset attempts for this IP
    security_manager.reset_attempts(client_ip)
    
    # Return filtered data for public view
    # Informants shouldn't see internal admin notes if they are sensitive, 
    # but the user asked for "admin_response" to be visible to them in the frontend before
    # Ley 2/2023 requires transparency. We use status_public_description for specific steps.
    return ComplaintResponse.model_validate(complaint)


def _ensure_complaint_admin(user: User):
    """Checks if the user has permission to manage complaints (Superadmin or RRHH with permission)"""
    if user.role_enum == UserRole.SUPERADMIN:
        return
    if user.role_enum == UserRole.RRHH and user.can_manage_complaints:
        return
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permiso para gestionar denuncias."
    )


@router.get("/admin/all", response_model=list[ComplaintResponse])
async def get_all_complaints_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get all complaints (RRHH with permission/Superadmin only)"""
    _ensure_complaint_admin(current_user)
    
    complaints = await get_all_complaints(session)
    return [ComplaintResponse.model_validate(c) for c in complaints]


@router.patch("/{complaint_id}/status", response_model=ComplaintResponse)
async def update_status_endpoint(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    complaint_id: UUID,
    new_status: str = Form(...),
    admin_notes: str | None = Form(None),
    status_public_description: str | None = Form(None)
):
    """Update complaint status (RRHH with permission/Superadmin only)"""
    _ensure_complaint_admin(current_user)
    
    # Validate status
    allowed_statuses = [s.value for s in ComplaintStatus]
    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Allowed: {', '.join(allowed_statuses)}"
        )
    
    complaint = await update_complaint_status(
        session=session,
        complaint_id=complaint_id,
        new_status=new_status,
        admin_id=current_user.id,
        admin_notes=admin_notes,
        status_public_description=status_public_description,
        ip_address=request.client.host
    )
    
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    
    # Broadcast update event
    from app.websocket.manager import websocket_manager
    # We should convert to Response model first to ensure no sensitive data leaks (though response model has public desc...)
    # Actually, broadcasting the RESPONSE model is safer than raw DB model.
    response_data = ComplaintResponse.model_validate(complaint).model_dump()
    # Convert UUIDs
    response_data['id'] = str(response_data['id'])

    await websocket_manager.broadcast({
        "type": "COMPLAINT_UPDATED",
        "data": response_data
    })
    
    return ComplaintResponse.model_validate(complaint)


@router.delete("/admin/{complaint_id}")
async def delete_complaint_endpoint(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    complaint_id: UUID
):
    """Delete a complaint and all its files (RRHH with permission/Superadmin only)"""
    _ensure_complaint_admin(current_user)
    
    success = await delete_complaint(
        session, 
        complaint_id, 
        user_id=current_user.id, 
        ip_address=request.client.host
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    
    # Broadcast delete event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "COMPLAINT_DELETED",
        "id": str(complaint_id)
    })

    return {"message": "Complaint and associated files deleted successfully"}

