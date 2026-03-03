from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, date as DateType
from enum import Enum
from uuid import UUID, uuid4
from sqlalchemy import Enum as SAEnum, Column


class HolidayType(str, Enum):
    NATIONAL = "nacional"
    LOCAL = "local"
    CONVENIO = "convenio"
    REGIONAL = "regional"
    OTHER = "otros"


class Holiday(SQLModel, table=True):
    __tablename__ = "holidays"
    
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    date: DateType
    name: str
    description: Optional[str] = None
    holiday_type: str = Field(index=True)
    created_by: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HolidayCreate(SQLModel):
    date: DateType
    name: str
    description: Optional[str] = None
    holiday_type: HolidayType


class HolidayUpdate(SQLModel):
    date: Optional[DateType] = None
    name: Optional[str] = None
    description: Optional[str] = None
    holiday_type: Optional[HolidayType] = None


class HolidayResponse(SQLModel):
    id: str
    date: DateType
    name: str
    description: Optional[str] = None
    holiday_type: HolidayType
    created_by: str
    created_at: datetime
    updated_at: datetime

