from datetime import date as DateType

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class UploadQuota(SQLModel, table=True):
    __tablename__ = "upload_quotas"
    __table_args__ = (UniqueConstraint("ip_address", "date", name="unique_ip_date"),)

    id: int | None = Field(default=None, primary_key=True)
    ip_address: str = Field(nullable=False)
    date: DateType = Field(default_factory=DateType.today)
    total_bytes: int = Field(default=0)
