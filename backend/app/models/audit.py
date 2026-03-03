from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import Column, JSON, DateTime
from pydantic import validator

if TYPE_CHECKING:
    from app.models.user import User

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(foreign_key="users.id", nullable=True)
    action: str = Field(index=True)
    module: str = Field(index=True)
    details: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    ip_address: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )

    # Relationship
    # user: Optional["User"] = Relationship()

class AuditLogCreate(SQLModel):
    user_id: Optional[UUID] = None
    action: str
    module: str
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None

class AuditUserResponse(SQLModel):
    id: UUID
    first_name: str
    last_name: str
    email: str

class AuditLogResponse(SQLModel):
    id: UUID
    user_id: Optional[UUID]
    user: Optional[AuditUserResponse] = None
    action: str
    module: str
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime
    
    @validator("created_at", check_fields=False)
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True
