from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel
from sqlalchemy import DateTime

if TYPE_CHECKING:
    pass

class Department(SQLModel, table=True):
    __tablename__ = "departments"
    
    id: UUID | None = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True)
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    # Relationship to users (optional, lazy)
    # users: List["User"] = Relationship(back_populates="department")

class Position(SQLModel, table=True):
    __tablename__ = "positions"
    
    id: UUID | None = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True)
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    # users: List["User"] = Relationship(back_populates="position")
