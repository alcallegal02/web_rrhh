from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, Union, List
from uuid import UUID, uuid4
from datetime import datetime, date
from pydantic import field_validator
from app.utils.duration import parse_duration

class ConvenioConfig(SQLModel, table=True):
    __tablename__ = "convenio_config"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    year_reference: int = Field(unique=True, index=True)
    
    # Base configuration
    daily_work_hours: float = Field(default=8.0) # Used for days/hours conversion
    
    # Maternity / Paternity Configuration
    maternity_weeks_total: int = Field(default=16)
    maternity_weeks_mandatory: int = Field(default=6)

    default_shift_start: Optional[str] = Field(default="08:00")
    default_shift_end: Optional[str] = Field(default="16:00")
    
    valid_from: date = Field(default_factory=date.today)
    valid_to: date = Field(default_factory=date.today)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ConvenioConfigCreate(SQLModel):
    year_reference: int
    daily_work_hours: float = 8.0
    maternity_weeks_total: int = 16
    maternity_weeks_mandatory: int = 6
    default_shift_start: Optional[str] = "08:00"
    default_shift_end: Optional[str] = "16:00"
    valid_from: date
    valid_to: date

class ConvenioConfigUpdate(SQLModel):
    daily_work_hours: Optional[float] = None
    maternity_weeks_total: Optional[int] = None
    maternity_weeks_mandatory: Optional[int] = None
    default_shift_start: Optional[str] = None
    default_shift_end: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
