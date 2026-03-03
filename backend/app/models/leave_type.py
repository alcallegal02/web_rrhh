from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime

class LeaveType(SQLModel, table=True):
    __tablename__ = "leave_types"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    
    # Configuration
    days_allocated: int = Field(default=1) # 0 for unlimited/variable? Or use null? Let's say default 1.
    is_work_days: bool = Field(default=False) # True = Work days, False = Calendar days (naturales)
    requires_justification: bool = Field(default=True)
    active: bool = Field(default=True)
    
    # Conventions/years this type applies to logic? 
    # For simplicity, these are global configurable types for now.
    # If we need versioning per year, we might link to ConvenioConfig.
    # User asked for "configure at will", so global editable list is best.
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
class LeaveTypeCreate(SQLModel):
    name: str
    description: Optional[str] = None
    days_allocated: int = 1
    is_work_days: bool = False
    requires_justification: bool = True
    active: bool = True

class LeaveTypeResponse(SQLModel):
    id: UUID
    name: str
    description: Optional[str] = None
    days_allocated: int
    is_work_days: bool
    requires_justification: bool
    active: bool
