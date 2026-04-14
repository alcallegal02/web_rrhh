from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel
from sqlalchemy import DateTime

class ConvenioConfig(SQLModel, table=True):
    __tablename__ = "convenio_config"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    year_reference: int = Field(unique=True, index=True)
    
    # Base configuration
    daily_work_hours: float = Field(default=8.0) # Used for days/hours conversion
    
    # Maternity / Paternity Configuration
    maternity_weeks_total: int = Field(default=16)
    maternity_weeks_mandatory: int = Field(default=6)

    default_shift_start: str | None = Field(default="08:00")
    default_shift_end: str | None = Field(default="16:00")
    
    valid_from: date = Field(default_factory=date.today)
    valid_to: date = Field(default_factory=date.today)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))

class ConvenioConfigCreate(SQLModel):
    year_reference: int
    daily_work_hours: float = 8.0
    maternity_weeks_total: int = 16
    maternity_weeks_mandatory: int = 6
    default_shift_start: str | None = "08:00"
    default_shift_end: str | None = "16:00"
    valid_from: date
    valid_to: date

class ConvenioConfigUpdate(SQLModel):
    daily_work_hours: float | None = None
    maternity_weeks_total: int | None = None
    maternity_weeks_mandatory: int | None = None
    default_shift_start: str | None = None
    default_shift_end: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
