from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import ConfigDict
from sqlmodel import Field, Relationship, SQLModel


class NewsStatus(str, Enum):
    BORRADOR = "borrador"
    PUBLICADA = "publicada"
    ARCHIVADA = "archivada"




class NewsAttachmentResponse(SQLModel):
    id: UUID
    news_id: UUID
    file_url: str
    file_original_name: str | None = None
    created_at: datetime


class NewsAttachment(SQLModel, table=True):
    __tablename__ = "news_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    news_id: UUID = Field(foreign_key="news.id")
    file_url: str
    file_original_name: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    news: "News" = Relationship(back_populates="attachments")

class News(SQLModel, table=True):
    __tablename__ = "news"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    summary: str | None = None
    content: str
    cover_image_url: str | None = None
    author_id: UUID = Field(foreign_key="users.id", index=True)
    status: str = Field(default="borrador", index=True)
    publish_date: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    attachments: list["NewsAttachment"] = Relationship(back_populates="news", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    @property
    def status_enum(self) -> NewsStatus:
        """Get status as enum"""
        try:
            return NewsStatus(self.status.lower())
        except ValueError:
            return NewsStatus.BORRADOR


class NewsCreate(SQLModel):
    title: str
    summary: str | None = None
    content: str
    cover_image_url: str | None = None
    status: str = "borrador"
    publish_date: datetime | None = None
    attachments: list[dict] | None = None


class NewsUpdate(SQLModel):
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    cover_image_url: str | None = None
    status: str | None = None
    publish_date: datetime | None = None
    attachments: list[dict] | None = None


class NewsResponse(SQLModel):
    id: UUID
    title: str
    summary: str | None = None
    content: str
    cover_image_url: str | None = None
    author_id: UUID
    status: str
    publish_date: datetime | None = None
    attachments: list[NewsAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

