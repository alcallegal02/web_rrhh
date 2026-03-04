from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel

if TYPE_CHECKING:
    pass

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID | None = Field(foreign_key="users.id", nullable=True)
    action: str = Field(index=True)
    module: str = Field(index=True)
    details: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    ip_address: str | None = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True))
    )

    # Relationship
    # user: Optional["User"] = Relationship()

class AuditLogCreate(SQLModel):
    user_id: UUID | None = None
    action: str
    module: str
    details: dict[str, Any] | None = None
    ip_address: str | None = None

class AuditUserResponse(SQLModel):
    id: UUID
    first_name: str
    last_name: str
    email: str

class AuditLogResponse(SQLModel):
    id: UUID
    user_id: UUID | None
    user: AuditUserResponse | None = None
    action: str
    module: str
    details: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime
    
    @field_validator("created_at")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    model_config = ConfigDict(from_attributes=True)
