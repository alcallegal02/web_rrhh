from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4
from sqlalchemy import Column, Enum as SAEnum


class NewsStatus(str, Enum):
    BORRADOR = "borrador"
    PUBLICADA = "publicada"
    ARCHIVADA = "archivada"




class NewsAttachmentResponse(SQLModel):
    id: UUID
    news_id: UUID
    file_url: str
    file_original_name: Optional[str] = None
    created_at: datetime


class NewsAttachment(SQLModel, table=True):
    __tablename__ = "news_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    news_id: UUID = Field(foreign_key="news.id")
    file_url: str
    file_original_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    news: "News" = Relationship(back_populates="attachments")

class News(SQLModel, table=True):
    __tablename__ = "news"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    summary: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    author_id: UUID = Field(foreign_key="users.id", index=True)
    status: str = Field(default="borrador", index=True)
    publish_date: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    attachments: List["NewsAttachment"] = Relationship(back_populates="news", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    @property
    def status_enum(self) -> NewsStatus:
        """Get status as enum"""
        try:
            return NewsStatus(self.status.lower())
        except ValueError:
            return NewsStatus.BORRADOR


class NewsCreate(SQLModel):
    title: str
    summary: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    status: str = "borrador"
    publish_date: Optional[datetime] = None
    attachments: Optional[List[dict]] = None


class NewsUpdate(SQLModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: Optional[str] = None
    publish_date: Optional[datetime] = None
    attachments: Optional[List[dict]] = None


class NewsResponse(SQLModel):
    id: UUID
    title: str
    summary: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    author_id: UUID
    status: str
    publish_date: Optional[datetime] = None
    attachments: List[NewsAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

