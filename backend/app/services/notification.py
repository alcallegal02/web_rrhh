import json
import logging
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.notification import Notification, NotificationType
from app.websocket.manager import websocket_manager

logger = logging.getLogger(__name__)

async def create_notification(
    session: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notif_type: NotificationType = NotificationType.SYSTEM,
    link: str | None = None,
    metadata_payload: dict | None = None
) -> Notification:
    """
    Create a notification in the database and broadcast via WebSocket
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        link=link,
        metadata_json=metadata_payload
    )
    
    session.add(notification)
    await session.commit()
    await session.refresh(notification)
    
    # Broadcast to user if connected
    try:
        await websocket_manager.send_personal_message(
            json.dumps({
                "type": "notification",
                "id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "link": notification.link,
                "notif_type": notification.type,
                "created_at": notification.created_at.isoformat()
            }),
            str(user_id)
        )
    except Exception as e:
        logger.error(f"Failed to broadcast notification to user {user_id}: {str(e)}")
        
    return notification

async def get_user_notifications(
    session: AsyncSession,
    user_id: UUID,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False
) -> list[Notification]:
    """Get notifications for a user"""
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())

async def mark_as_read(session: AsyncSession, notification_id: UUID, user_id: UUID) -> bool:
    """Mark a notification as read"""
    stmt = select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    result = await session.execute(stmt)
    notif = result.scalar_one_or_none()
    
    if notif:
        notif.is_read = True
        await session.commit()
        return True
    return False

async def mark_all_as_read(session: AsyncSession, user_id: UUID):
    """Mark all notifications for a user as read"""
    from sqlalchemy import update
    stmt = update(Notification).where(Notification.user_id == user_id, Notification.is_read == False).values(is_read=True)
    await session.execute(stmt)
    await session.commit()
