from sqlmodel import SQLModel, Field
from datetime import date as DateType, datetime
from typing import Optional
from sqlalchemy import UniqueConstraint

class UploadQuota(SQLModel, table=True):
    __tablename__ = "upload_quotas"
    __table_args__ = (UniqueConstraint("ip_address", "date", name="unique_ip_date"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    ip_address: str = Field(nullable=False)
    date: DateType = Field(default_factory=DateType.today)
    total_bytes: int = Field(default=0)
