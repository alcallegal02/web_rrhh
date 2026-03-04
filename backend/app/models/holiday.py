from datetime import date as DateType
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import ConfigDict
from sqlmodel import Field, SQLModel


class HolidayType(str, Enum):
    NATIONAL = "nacional"
    LOCAL = "local"
    CONVENIO = "convenio"
    REGIONAL = "regional"
    OTHER = "otros"


class Holiday(SQLModel, table=True):
    __tablename__ = "holidays"
    
    id: UUID | None = Field(default_factory=uuid4, primary_key=True)
    date: DateType
    name: str
    description: str | None = None
    holiday_type: str = Field(index=True)
    created_by: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HolidayCreate(SQLModel):
    date: DateType
    name: str
    description: str | None = None
    holiday_type: HolidayType
    
    model_config = ConfigDict(from_attributes=True)


class HolidayUpdate(SQLModel):
    date: DateType | None = None
    name: str | None = None
    description: str | None = None
    holiday_type: HolidayType | None = None


class HolidayResponse(SQLModel):
    id: str
    date: DateType
    name: str
    description: str | None = None
    holiday_type: HolidayType
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

