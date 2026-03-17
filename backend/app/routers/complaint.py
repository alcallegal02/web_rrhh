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
    CommentCreate,
    CommentResponse,
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
    from app.services.complaint import process_and_save_complaint_files, create_complaint
    from app.models.complaint import ComplaintAttachment
    from sqlalchemy.orm import selectinload
    from sqlmodel import select

    # 1. Create the complaint first (without attachments) to get its ID
    complaint_data = ComplaintCreate(
        title=title,
        description=description,
        attachments=None
    )

    try:
        complaint = await create_complaint(session, complaint_data)
        complaint_id_str = str(complaint.id)

        # 2. Process files via service using the new complaint ID for folder organization
        if files:
            attachments = await process_and_save_complaint_files(
                files, 
                session, 
                request.client.host,
                entity_id=complaint_id_str
            )

            # 3. Add the attachments to the DB and link them to the complaint
            for att in attachments:
                attachment = ComplaintAttachment(
                    complaint_id=complaint.id,
                    file_url=att['file_url'],
                    file_original_name=att.get('file_original_name')
                )
                session.add(attachment)

            await session.commit()

            # Reload to include new attachments in response
            result = await session.execute(
                select(Complaint).where(Complaint.id == complaint.id).options(selectinload(Complaint.attachments))
            )
            complaint = result.scalar_one()

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
        await websocket_manager.broadcast({
            "type": "COMPLAINT_CREATED",
            "data": { "id": str(complaint.id), "title": complaint.title, "status": complaint.status }
        })

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
    
    # Filter only public comments for public view
    complaint.comments = [c for c in complaint.comments if c.is_public]
    
    # Return filtered data for public view
    return ComplaintResponse.model_validate(complaint)


@router.post("/{code}/comments", response_model=CommentResponse)
@limiter.limit("5/minute")
async def add_public_comment(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    code: str,
    token: Annotated[str, Query(description="Access token/Security key")],
    content: str = Form(...),
    files: list[UploadFile] = File(default=[])
):
    """Add a response as reporter (public endpoint)"""
    complaint = await verify_complaint_access(session, code, token)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Denuncia no encontrada o clave incorrecta."
        )
    
    from app.services.complaint.crud import process_and_save_complaint_files, create_complaint_comment
    
    # Process files
    attachments = []
    if files:
        attachments = await process_and_save_complaint_files(
            files,
            session,
            request.client.host,
            entity_id=str(complaint.id) # Use complaint ID for folder organization
        )

    comment = await create_complaint_comment(
        session=session,
        complaint_id=complaint.id,
        content=content,
        is_public=True,
        user_id=None,
        attachments=attachments
    )
    
    # Broadcast event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "COMPLAINT_COMMENT_ADDED",
        "data": {
            "complaint_id": str(complaint.id),
            "is_public": True,
            "status": complaint.status
        }
    })
    
    return CommentResponse.model_validate(comment)


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
    response_data = ComplaintResponse.model_validate(complaint).model_dump()
    response_data['id'] = str(response_data['id'])

    await websocket_manager.broadcast({
        "type": "COMPLAINT_UPDATED",
        "data": response_data
    })
    
    return ComplaintResponse.model_validate(complaint)


@router.post("/admin/{complaint_id}/comments", response_model=CommentResponse)
async def add_admin_comment(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    complaint_id: UUID,
    content: str = Form(...),
    is_public: bool = Form(True),
    files: list[UploadFile] = File(default=[])
):
    """Add a public or private comment by RRHH/Admin"""
    _ensure_complaint_admin(current_user)
    
    from app.services.complaint.crud import process_and_save_complaint_files, create_complaint_comment
    
    # Process files
    attachments = []
    if files:
        attachments = await process_and_save_complaint_files(
            files,
            session,
            request.client.host,
            entity_id=str(complaint_id)
        )

    comment = await create_complaint_comment(
        session=session,
        complaint_id=complaint_id,
        content=content,
        is_public=is_public,
        user_id=current_user.id,
        attachments=attachments
    )
    
    if not comment:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    # Set user name for response
    comment_resp = CommentResponse.model_validate(comment)
    comment_resp.user_name = f"{current_user.first_name} {current_user.last_name}" if current_user.first_name else current_user.email

    # Broadcast event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "COMPLAINT_COMMENT_ADDED",
        "data": {
            "complaint_id": str(complaint_id),
            "is_public": is_public,
            "user_id": str(current_user.id)
        }
    })
    
    return comment_resp


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
