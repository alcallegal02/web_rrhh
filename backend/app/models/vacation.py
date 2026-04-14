from datetime import date, datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from pydantic import ConfigDict
from sqlmodel import Field, SQLModel
from sqlalchemy import DateTime


class RequestType(str, Enum):
    VACACIONES = "vacaciones"
    ASUNTOS_PROPIOS = "asuntos_propios"
    MEDICO_GENERAL = "medico_general"
    MEDICO_ESPECIALISTA = "medico_especialista"
    DIAS_COMPENSADOS = "dias_compensados"
    LICENCIA_RETRIBUIDA = "licencia_retribuida"
    BOLSA_HORAS = "bolsa_horas"
    HORAS_SINDICALES = "horas_sindicales"
    TELETRABAJO = "teletrabajo"
    # New Types
    BAJA_ENFERMEDAD = "baja_enfermedad"
    BAJA_ACCIDENTE = "baja_accidente"
    MATERNIDAD_PATERNIDAD = "maternidad_paternidad"
    ABSENTISMO_NO_RETRIBUIDO = "absentismo_no_retribuido"
    LICENCIA_NO_RETRIBUIDA = "licencia_no_retribuida"
    VISITA_CLIENTES = "visita_clientes"
    ENFERMO_EN_CASA = "enfermo_en_casa"
    PERMISOS = "permisos"


class RequestStatus(str, Enum):
    BORRADOR = "borrador"
    PENDING = "pending"
    APPROVED_MANAGER = "approved_manager"
    REJECTED_MANAGER = "rejected_manager"
    APPROVED_RRHH = "approved_rrhh"
    REJECTED_RRHH = "rejected_rrhh"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class VacationRequestStatus(str, Enum):
    BORRADOR = "borrador"
    PENDING = "pending"
    APPROVED_MANAGER = "approved_manager"
    REJECTED_MANAGER = "rejected_manager"
    APPROVED_RRHH = "approved_rrhh"
    REJECTED_RRHH = "rejected_rrhh"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class VacationAttachment(SQLModel, table=True):
    __tablename__ = "vacation_attachments"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    request_id: UUID = Field(foreign_key="vacation_requests.id")
    file_url: str
    file_original_name: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
    # request: "VacationRequest" = Relationship(back_populates="attachments")


class VacationRequest(SQLModel, table=True):
    __tablename__ = "vacation_requests"
    
    id: UUID | None = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    request_type: str = Field(index=True)
    leave_type_id: UUID | None = Field(default=None, foreign_key="leave_types.id") # Deprecated
    policy_id: UUID | None = Field(default=None, foreign_key="permission_policies.id", index=True) # New FK
    start_date: datetime = Field(index=True, sa_type=DateTime(timezone=True))
    end_date: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    days_requested: float
    status: str = Field(default="borrador", index=True)
    assigned_manager_id: UUID | None = Field(default=None, foreign_key="users.id")
    assigned_rrhh_id: UUID | None = Field(default=None, foreign_key="users.id")
    manager_approved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    manager_approved_by: UUID | None = Field(default=None, foreign_key="users.id")
    rrhh_approved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    rrhh_approved_by: UUID | None = Field(default=None, foreign_key="users.id")
    rejection_reason: str | None = None
    description: str | None = None

    # Dynamic Form Fields
    causal_date: date | None = None # For POR_EVENTO resets
    child_name: str | None = None
    child_birthdate: date | None = None
    telework_percentage: float | None = None # For mixta modality
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))

    # Relationships for Eager Loading
    # user: "User" = Relationship(sa_relationship_kwargs={"primaryjoin": "VacationRequest.user_id==User.id", "lazy": "selectin"})
    
    # assigned_manager: Optional["User"] = Relationship(
    #     sa_relationship_kwargs={"primaryjoin": "VacationRequest.assigned_manager_id==User.id", "lazy": "selectin"}
    # )
    
    # assigned_rrhh: Optional["User"] = Relationship(
    #     sa_relationship_kwargs={"primaryjoin": "VacationRequest.assigned_rrhh_id==User.id", "lazy": "selectin"}
    # )
    
    # manager_approver: Optional["User"] = Relationship(
    #     sa_relationship_kwargs={"primaryjoin": "VacationRequest.manager_approved_by==User.id", "lazy": "selectin"}
    # )
    
    # rrhh_approver: Optional["User"] = Relationship(
    #     sa_relationship_kwargs={"primaryjoin": "VacationRequest.rrhh_approved_by==User.id", "lazy": "selectin"}
    # )
    
    # attachments: List["VacationAttachment"] = Relationship(back_populates="request", sa_relationship_kwargs={"cascade": "all, delete-orphan", "lazy": "selectin"})


class VacationRequestCreate(SQLModel):
    request_type: RequestType | None = None # Made optional for backward compatibility, eventually deprecated
    policy_id: str | None = None # The new way
    leave_type_id: str | None = None # UUID as str for JSON
    start_date: datetime
    end_date: datetime | None = None
    days_requested: float | str
    assigned_manager_id: str | None = None
    assigned_rrhh_id: str | None = None
    description: str | None = None
    status: RequestStatus | None = RequestStatus.BORRADOR
    attachments: list[dict] | None = None # List of {file_url, file_original_name}
    
    # Dynamic fields
    causal_date: date | None = None
    child_name: str | None = None
    child_birthdate: date | None = None
    telework_percentage: float | None = None
    
    model_config = ConfigDict(from_attributes=True)


class VacationAttachmentResponse(SQLModel):
    id: UUID
    file_url: str
    file_original_name: str | None = None
    created_at: datetime

class VacationRequestResponse(SQLModel):
    id: str
    user_id: str
    request_type: str # Changed from RequestType enum to str to allow dynamic slugs
    policy_id: str | None = None
    leave_type_id: str | None = None
    start_date: datetime
    end_date: datetime | None
    days_requested: float
    status: RequestStatus
    assigned_manager_id: str | None = None
    assigned_rrhh_id: str | None = None
    manager_approved_at: datetime | None = None
    manager_approved_by: str | None = None
    rrhh_approved_at: datetime | None = None
    rrhh_approved_by: str | None = None
    rejection_reason: str | None = None
    description: str | None = None
    
    # Dynamic fields
    causal_date: date | None = None
    child_name: str | None = None
    child_birthdate: date | None = None
    telework_percentage: float | None = None

    attachments: list[VacationAttachmentResponse] | None = []
    attachments: list[VacationAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime
    # Include user info for display
    user_name: str | None = None
    assigned_manager_name: str | None = None
    assigned_rrhh_name: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


class CategoryBalance(SQLModel):
    total_days: float
    used_days: float
    pending_days: float
    available_days: float


class VacationBalance(SQLModel):
    vacaciones: CategoryBalance
    asuntos_propios: CategoryBalance
    medico_general: CategoryBalance
    medico_especialista: CategoryBalance
    dias_compensados: CategoryBalance
    licencia_retribuida: CategoryBalance
    bolsa_horas: CategoryBalance
    horas_sindicales: CategoryBalance
    maternidad_paternidad: CategoryBalance
    daily_work_hours: float = 8.0

