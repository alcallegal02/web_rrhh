from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, DateTime, String, Boolean, JSON

class NotificationType(str, Enum):
    VACATION_REQUEST = "vacation_request"
    VACATION_APPROVED = "vacation_approved"
    VACATION_REJECTED = "vacation_rejected"
    NEWS_PUBLISHED = "news_published"
    SYSTEM = "system"

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    
    title: str
    message: str
    type: str = Field(default=NotificationType.SYSTEM)
    
    # Optional link to the entity (e.g. /vacations?id=...)
    link: str | None = None
    
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    # Metadata for specific actions (e.g. {request_id: "..."})
    metadata_json: dict | None = Field(default=None, sa_column=Column(JSON))

class NotificationResponse(SQLModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    link: str | None
    is_read: bool
    created_at: datetime
    metadata_json: dict | None
