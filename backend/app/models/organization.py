from typing import Optional, List, TYPE_CHECKING
from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.user import User

class Department(SQLModel, table=True):
    __tablename__ = "departments"
    
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship to users (optional, lazy)
    # users: List["User"] = Relationship(back_populates="department")

class Position(SQLModel, table=True):
    __tablename__ = "positions"
    
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(unique=True, index=True)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # users: List["User"] = Relationship(back_populates="position")
