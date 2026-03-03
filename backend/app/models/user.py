from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4
from sqlalchemy import Column, Enum as SAEnum, DateTime, ForeignKey, String
import sqlalchemy as sa

if TYPE_CHECKING:
    from app.models.absence import UserBalance
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


class UserAttachmentResponse(SQLModel):
    id: UUID
    user_id: UUID
    file_url: str
    file_original_name: Optional[str] = None
    created_at: datetime


class UserAttachment(SQLModel, table=True):
    __tablename__ = "user_attachments"
    
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id")
    file_url: str
    file_original_name: Optional[str] = None
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
    
    id: Optional[UUID] = Field(
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
    
    department_uuid: Optional[UUID] = Field(default=None, sa_column=Column("department_id", sa.UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True))
    position_uuid: Optional[UUID] = Field(default=None, sa_column=Column("position_id", sa.UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), nullable=True))
    
    department: Optional["Department"] = Relationship(sa_relationship_kwargs={"lazy": "selectin"})
    position: Optional["Position"] = Relationship(sa_relationship_kwargs={"lazy": "selectin"})
    
    photo_url: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Password Reset OTP
    reset_password_otp: Optional[str] = None
    reset_password_otp_expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
    
    attachments: List["UserAttachment"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"})
    
    managers_links: List["UserManagerLink"] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "User.id==UserManagerLink.user_id",
            "cascade": "all, delete-orphan",
             "lazy": "selectin"
        }
    )

    rrhh_links: List["UserRrhhLink"] = Relationship(
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
    contract_start_date: Optional[datetime] = Field(default=None)
    contract_expiration_date: Optional[datetime] = Field(default=None)
    percentage_jornada: float = Field(default=1.0, sa_column=Column(sa.Float, nullable=False, server_default=sa.text("1.0")))
    
    shift_start: Optional[str] = Field(default=None) # HH:mm
    shift_end: Optional[str] = Field(default=None)   # HH:mm
    shift_end: Optional[str] = Field(default=None)   # HH:mm
    created_by: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    updated_by: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    
    # Hierarchy
    parent_id: Optional[UUID] = Field(default=None, sa_column=Column(sa.UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True))
    parent: Optional["User"] = Relationship(sa_relationship_kwargs={
        "remote_side": "User.id",
        "lazy": "selectin",
        "foreign_keys": "User.parent_id"
    })
    
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
    username: str
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.EMPLEADO
    managers: Optional[List[UUID]] = None
    rrhh_ids: Optional[List[UUID]] = None
    
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    
    photo_url: Optional[str] = None
    attachments: Optional[List[dict]] = None
    contract_start_date: Optional[datetime] = None
    contract_expiration_date: Optional[datetime] = None
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


class UserUpdate(SQLModel):
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    managers: Optional[List[UUID]] = None
    rrhh_ids: Optional[List[UUID]] = None
    
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    
    photo_url: Optional[str] = None
    attachments: Optional[List[dict]] = None
    contract_start_date: Optional[datetime] = None
    contract_expiration_date: Optional[datetime] = None
    percentage_jornada: Optional[float] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    is_active: Optional[bool] = None
    
    vac_days: Optional[float] = None
    vac_hours: Optional[float] = None
    asuntos_propios_days: Optional[float] = None
    asuntos_propios_hours: Optional[float] = None
    dias_compensados_days: Optional[float] = None
    dias_compensados_hours: Optional[float] = None
    med_gral_days: Optional[float] = None
    med_gral_hours: Optional[float] = None
    med_especialista_days: Optional[float] = None
    med_especialista_hours: Optional[float] = None
    licencia_retribuida_days: Optional[float] = None
    licencia_retribuida_hours: Optional[float] = None
    bolsa_horas_days: Optional[float] = None
    bolsa_horas_hours: Optional[float] = None
    horas_sindicales_days: Optional[float] = None
    horas_sindicales_hours: Optional[float] = None


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
    managers: List[UserSummary] = []
    rrhh_responsibles: List[UserSummary] = []
    parent: Optional[UserSummary] = None
    
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    department_name: Optional[str] = Field(default=None, serialization_alias="department")
    position_name: Optional[str] = Field(default=None, serialization_alias="position")
    
    photo_url: Optional[str] = None
    attachments: List[UserAttachmentResponse] = []
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    
    contract_start_date: Optional[datetime] = None
    contract_expiration_date: Optional[datetime] = None
    percentage_jornada: float = 1.0
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    
    vac_days: Optional[float] = 0
    vac_hours: Optional[float] = 0
    asuntos_propios_days: Optional[float] = 0
    asuntos_propios_hours: Optional[float] = 0
    dias_compensados_days: Optional[float] = 0
    dias_compensados_hours: Optional[float] = 0
    med_gral_days: Optional[float] = 0
    med_gral_hours: Optional[float] = 0
    med_especialista_days: Optional[float] = 0
    med_especialista_hours: Optional[float] = 0
    licencia_retribuida_days: Optional[float] = 0
    licencia_retribuida_hours: Optional[float] = 0
    bolsa_horas_days: Optional[float] = 0
    bolsa_horas_hours: Optional[float] = 0
    horas_sindicales_days: Optional[float] = 0
    horas_sindicales_hours: Optional[float] = 0


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"
