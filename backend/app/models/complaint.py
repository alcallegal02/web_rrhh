from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import ConfigDict
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import DateTime


class ComplaintStatus(str, Enum):
    ENTREGADA = "entregada"
    PENDIENTE = "pendiente"
    EN_ANALISIS = "en_analisis"
    EN_INVESTIGACION = "en_investigacion"
    INFORMACION_REQUERIDA = "informacion_requerida"
    RESUELTA = "resuelta"
    DESESTIMADA = "desestimada"


class ComplaintAttachmentResponse(SQLModel):
    id: UUID
    complaint_id: UUID
    file_url: str
    file_original_name: str | None = None
    created_at: datetime


class CommentAttachmentResponse(SQLModel):
    id: UUID
    comment_id: UUID
    file_url: str
    file_original_name: str | None = None
    created_at: datetime


class CommentResponse(SQLModel):
    id: UUID
    complaint_id: UUID
    user_id: UUID | None = None
    user_name: str | None = None
    content: str
    is_public: bool
    complaint_status: str
    attachments: List[CommentAttachmentResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplaintAttachment(SQLModel, table=True):
    __tablename__ = "complaint_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    complaint_id: UUID = Field(foreign_key="complaints.id")
    file_url: str
    file_original_name: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    complaint: "Complaint" = Relationship(back_populates="attachments")


class CommentAttachment(SQLModel, table=True):
    __tablename__ = "comment_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    comment_id: UUID = Field(foreign_key="complaint_comments.id")
    file_url: str
    file_original_name: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    comment: "ComplaintComment" = Relationship(back_populates="attachments")


class ComplaintComment(SQLModel, table=True):
    __tablename__ = "complaint_comments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    complaint_id: UUID = Field(foreign_key="complaints.id")
    user_id: UUID | None = Field(foreign_key="users.id", default=None)
    content: str
    is_public: bool = Field(default=True)
    complaint_status: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    complaint: "Complaint" = Relationship(back_populates="comments")
    author: Optional["User"] = Relationship()
    attachments: List["CommentAttachment"] = Relationship(back_populates="comment", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Complaint(SQLModel, table=True):
    __tablename__ = "complaints"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(unique=True, index=True)
    title: str
    description: str
    file_path: str | None = None
    file_original_name: str | None = None
    status: str = Field(default=ComplaintStatus.ENTREGADA.value, index=True)
    status_public_description: str | None = None
    admin_response: str | None = None
    access_token: str = Field(index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True, sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))

    attachments: List["ComplaintAttachment"] = Relationship(back_populates="complaint", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    comments: List["ComplaintComment"] = Relationship(back_populates="complaint", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class ComplaintCreate(SQLModel):
    title: str
    description: str
    file_path: str | None = None
    file_original_name: str | None = None
    attachments: list[dict] | None = None
    
    model_config = ConfigDict(from_attributes=True)


class ComplaintResponse(SQLModel):
    id: UUID
    code: str
    title: str
    description: str
    file_path: str | None = None
    file_original_name: str | None = None
    status: str
    status_public_description: str | None = None
    admin_response: str | None = None
    attachments: list[ComplaintAttachmentResponse] = []
    comments: list[CommentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommentCreate(SQLModel):
    content: str
    is_public: bool = True


class ComplaintCreateResponse(ComplaintResponse):
    access_token: str


class ComplaintStatusLog(SQLModel, table=True):
    __tablename__ = "complaint_status_logs"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    complaint_id: UUID = Field(foreign_key="complaints.id")
    old_status: str
    new_status: str
    admin_notes: str | None = None
    changed_by_id: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
