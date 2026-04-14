from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.notification import NotificationResponse
from app.models.user import User
from app.routers.auth import get_current_user
import app.services.notification as NotificationService

router = APIRouter(tags=["notifications"])

@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False
):
    """List notifications for the current user"""
    return await NotificationService.get_user_notifications(
        session, current_user.id, limit, offset, unread_only
    )

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Mark a notification as read"""
    success = await NotificationService.mark_as_read(session, notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_as_read(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Mark all notifications as read"""
    await NotificationService.mark_all_as_read(session, current_user.id)
    return {"status": "success"}
