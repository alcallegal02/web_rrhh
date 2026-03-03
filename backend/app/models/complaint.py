from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4


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
    file_original_name: Optional[str] = None
    created_at: datetime


class ComplaintAttachment(SQLModel, table=True):
    __tablename__ = "complaint_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    complaint_id: UUID = Field(foreign_key="complaints.id")
    file_url: str
    file_original_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # complaint: "Complaint" = Relationship(back_populates="attachments")


class Complaint(SQLModel, table=True):
    __tablename__ = "complaints"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(unique=True, index=True)
    title: str
    description: str
    file_path: Optional[str] = None
    file_original_name: Optional[str] = None
    status: str = Field(default=ComplaintStatus.ENTREGADA.value, index=True)
    status_public_description: Optional[str] = None
    admin_response: Optional[str] = None
    access_token: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # attachments: List["ComplaintAttachment"] = Relationship(back_populates="complaint", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class ComplaintCreate(SQLModel):
    title: str
    description: str
    file_path: Optional[str] = None
    file_original_name: Optional[str] = None
    attachments: Optional[List[dict]] = None


class ComplaintResponse(SQLModel):
    id: UUID
    code: str
    title: str
    description: str
    file_path: Optional[str] = None
    file_original_name: Optional[str] = None
    status: str
    status_public_description: Optional[str] = None
    admin_response: Optional[str] = None
    attachments: List[ComplaintAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComplaintCreateResponse(ComplaintResponse):
    access_token: str


class ComplaintStatusLog(SQLModel, table=True):
    __tablename__ = "complaint_status_logs"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    complaint_id: UUID = Field(foreign_key="complaints.id")
    old_status: str
    new_status: str
    admin_notes: Optional[str] = None
    changed_by_id: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
