from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from pydantic import ConfigDict

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, ForeignKey
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.organization import Department, Position


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    RRHH = "rrhh"
    EMPLEADO = "empleado"
    
    @classmethod
    def _missing_(cls, value):
        # Handle lowercase values from database
        if isinstance(value, str):
            value_lower = value.lower()
            for member in cls:
                if member.value == value_lower:
                    return member
        return None

    model_config = ConfigDict(use_enum_values=True)


class UserAttachmentResponse(SQLModel):
    id: UUID
    user_id: UUID
    file_url: str
    file_original_name: str | None = None
    created_at: datetime


class UserAttachment(SQLModel, table=True):
    __tablename__ = "user_attachments"
    
    id: UUID | None = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id")
    file_url: str
    file_original_name: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: "User" = Relationship(back_populates="attachments")


class UserSummary(SQLModel):
    id: UUID
    first_name: str
    last_name: str
    full_name: str


class UserManagerLink(SQLModel, table=True):
    __tablename__ = "user_managers_link"
    
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    )
    manager_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    )
    
    manager: "User" = Relationship(sa_relationship_kwargs={
        "foreign_keys": "UserManagerLink.manager_id",
        "primaryjoin": "UserManagerLink.manager_id==User.id",
        "viewonly": True
    })

class UserRrhhLink(SQLModel, table=True):
    __tablename__ = "user_rrhh_link"
    
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    )
    rrhh_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    )
    
    rrhh_member: "User" = Relationship(sa_relationship_kwargs={
        "foreign_keys": "UserRrhhLink.rrhh_id",
        "primaryjoin": "UserRrhhLink.rrhh_id==User.id",
        "viewonly": True
    })


class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: UUID | None = Field(
        default_factory=uuid4, 
        sa_column=Column(
            sa.UUID(as_uuid=True), 
            primary_key=True, 
            server_default=sa.text("uuid_generate_v4()")
        )
    )
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    first_name: str
    last_name: str
    role: str = Field(default="empleado", sa_column=Column(sa.String, nullable=False, server_default=sa.text("'empleado'")))
    
    department_uuid: UUID | None = Field(default=None, sa_column=Column("department_id", sa.UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True))
    position_uuid: UUID | None = Field(default=None, sa_column=Column("position_id", sa.UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), nullable=True))
    
    department: Optional["Department"] = Relationship(sa_relationship_kwargs={"lazy": "selectin"})
    position: Optional["Position"] = Relationship(sa_relationship_kwargs={"lazy": "selectin"})
    
    photo_url: str | None = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Password Reset OTP
    reset_password_otp: str | None = None
    reset_password_otp_expires_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
    
    attachments: list["UserAttachment"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"})
    
    managers_links: list["UserManagerLink"] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "User.id==UserManagerLink.user_id",
            "cascade": "all, delete-orphan",
             "lazy": "selectin"
        }
    )

    rrhh_links: list["UserRrhhLink"] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "User.id==UserRrhhLink.user_id",
            "cascade": "all, delete-orphan",
            "lazy": "selectin"
        }
    )

    # balances: List["UserBalance"] = Relationship(back_populates="user")

    # Allowances (days / hours) per category
    vac_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    vac_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    asuntos_propios_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    asuntos_propios_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    dias_compensados_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    dias_compensados_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    med_gral_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    med_gral_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    med_especialista_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    med_especialista_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    licencia_retribuida_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    licencia_retribuida_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    bolsa_horas_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    bolsa_horas_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    horas_sindicales_days: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    horas_sindicales_hours: float = Field(default=0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("0")))
    
    # Life Cycle & Auditing
    contract_start_date: datetime | None = Field(default=None)
    contract_expiration_date: datetime | None = Field(default=None)
    percentage_jornada: float = Field(default=1.0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("1.0")))
    
    shift_start: str | None = Field(default=None) # HH:mm
    shift_end: str | None = Field(default=None)   # HH:mm
    shift_end: str | None = Field(default=None)   # HH:mm
    created_by: UUID | None = Field(default=None, foreign_key="users.id", index=True)
    updated_by: UUID | None = Field(default=None, foreign_key="users.id", index=True)
    
    # Hierarchy
    parent_id: UUID | None = Field(default=None, sa_column=Column(sa.UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    parent: Optional["User"] = Relationship(sa_relationship_kwargs={
        "remote_side": "User.id",
        "lazy": "selectin",
        "foreign_keys": "User.parent_id"
    })

    # Permissions & Notifications
    can_manage_complaints: bool = Field(default=False, sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("false")))
    notif_own_requests: bool = Field(default=True, sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("true")))
    notif_managed_requests: bool = Field(default=True, sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("true")))
    notif_complaints: bool = Field(default=True, sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("true")))
    notif_news: bool = Field(default=True, sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("true")))
    
    @property
    def role_enum(self) -> UserRole:
        """Get role as enum"""
        try:
            return UserRole(self.role.lower())
        except ValueError:
            return UserRole.EMPLEADO

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserCreate(SQLModel):
    id: UUID | None = None
    username: str
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.EMPLEADO
    managers: list[UUID] | None = None
    rrhh_ids: list[UUID] | None = None
    
    department_id: UUID | None = None
    position_id: UUID | None = None
    parent_id: UUID | None = None
    
    photo_url: str | None = None
    attachments: list[dict] | None = None
    contract_start_date: datetime | None = None
    contract_expiration_date: datetime | None = None
    percentage_jornada: float = 1.0
    
    vac_days: float = 0
    vac_hours: float = 0
    asuntos_propios_days: float = 0
    asuntos_propios_hours: float = 0
    dias_compensados_days: float = 0
    dias_compensados_hours: float = 0
    med_gral_days: float = 0
    med_gral_hours: float = 0
    med_especialista_days: float = 0
    med_especialista_hours: float = 0
    licencia_retribuida_days: float = 0
    licencia_retribuida_hours: float = 0
    bolsa_horas_days: float = 0
    bolsa_horas_hours: float = 0
    horas_sindicales_days: float = 0
    horas_sindicales_hours: float = 0
    
    can_manage_complaints: bool = False
    notif_own_requests: bool = True
    notif_managed_requests: bool = True
    notif_complaints: bool = True
    notif_news: bool = True


class UserUpdate(SQLModel):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    password: str | None = None
    role: UserRole | None = None
    managers: list[UUID] | None = None
    rrhh_ids: list[UUID] | None = None
    
    department_id: UUID | None = None
    position_id: UUID | None = None
    parent_id: UUID | None = None
    
    photo_url: str | None = None
    attachments: list[dict] | None = None
    contract_start_date: datetime | None = None
    contract_expiration_date: datetime | None = None
    percentage_jornada: float | None = None
    shift_start: str | None = None
    shift_end: str | None = None
    is_active: bool | None = None
    
    vac_days: float | None = None
    vac_hours: float | None = None
    asuntos_propios_days: float | None = None
    asuntos_propios_hours: float | None = None
    dias_compensados_days: float | None = None
    dias_compensados_hours: float | None = None
    med_gral_days: float | None = None
    med_gral_hours: float | None = None
    med_especialista_days: float | None = None
    med_especialista_hours: float | None = None
    licencia_retribuida_days: float | None = None
    licencia_retribuida_hours: float | None = None
    bolsa_horas_days: float | None = None
    bolsa_horas_hours: float | None = None
    horas_sindicales_days: float | None = None
    horas_sindicales_hours: float | None = None
    
    can_manage_complaints: bool | None = None
    notif_own_requests: bool | None = None
    notif_managed_requests: bool | None = None
    notif_complaints: bool | None = None
    notif_news: bool | None = None


class UserLogin(SQLModel):
    username_or_email: str
    password: str


class UserResponse(SQLModel):
    id: UUID
    username: str
    email: str
    first_name: str
    last_name: str
    full_name: str 
    role: str
    managers: list[UserSummary] = []
    rrhh_responsibles: list[UserSummary] = []
    parent: UserSummary | None = None
    
    department_id: UUID | None = None
    position_id: UUID | None = None
    department_name: str | None = Field(default=None, serialization_alias="department")
    position_name: str | None = Field(default=None, serialization_alias="position")
    
    photo_url: str | None = None
    attachments: list[UserAttachmentResponse] = []
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    contract_start_date: datetime | None = None
    contract_expiration_date: datetime | None = None
    percentage_jornada: float = 1.0
    shift_start: str | None = None
    shift_end: str | None = None
    created_by: UUID | None = None
    updated_by: UUID | None = None
    created_by_name: str | None = None
    updated_by_name: str | None = None
    
    vac_days: float | None = 0
    vac_hours: float | None = 0
    asuntos_propios_days: float | None = 0
    asuntos_propios_hours: float | None = 0
    dias_compensados_days: float | None = 0
    dias_compensados_hours: float | None = 0
    med_gral_days: float | None = 0
    med_gral_hours: float | None = 0
    med_especialista_days: float | None = 0
    med_especialista_hours: float | None = 0
    licencia_retribuida_days: float | None = 0
    licencia_retribuida_hours: float | None = 0
    bolsa_horas_days: float | None = 0
    bolsa_horas_hours: float | None = 0
    horas_sindicales_days: float | None = 0
    horas_sindicales_hours: float | None = 0
    
    can_manage_complaints: bool = False
    notif_own_requests: bool = True
    notif_managed_requests: bool = True
    notif_complaints: bool = True
    notif_news: bool = True


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"
