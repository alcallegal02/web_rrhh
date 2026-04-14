from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel
from sqlalchemy import DateTime


class DurationUnit(str, Enum):
    DAYS_NATURAL = "days_natural" # Dias naturales
    DAYS_WORK = "days_work"       # Dias habiles
    WEEKS = "weeks"
    HOURS = "hours"

class Modality(str, Enum):
    PRESENCIAL_AUSENTE = "presencial_ausente"
    TELETRABAJO = "teletrabajo"
    MIXTO = "mixto"

class PolicyResetType(str, Enum):
    ANUAL_CALENDARIO = "anual_calendario" # Resets Jan 1st
    ANUAL_RELATIVO = "anual_relativo"     # Resets 1 year after first use
    POR_EVENTO = "por_evento"             # Per specific event occurrence
    SIN_REINICIO = "sin_reinicio"         # Single pool (history)

class PermissionPolicy(SQLModel, table=True):
    __tablename__ = "permission_policies"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    slug: str = Field(unique=True, index=True) 
    name: str = Field(index=True)
    description: str | None = None
    
    # Duration Rules
    duration_value: float 
    duration_unit: str = Field(default=DurationUnit.DAYS_NATURAL) 
    
    # Configuration
    is_paid: bool = Field(default=True)
    requires_justification: bool = Field(default=True)
    modality: str = Field(default=Modality.PRESENCIAL_AUSENTE)
    limit_age_child: int | None = None
    
    # Recurrence & Lifecycle (Refactor 2026)
    reset_type: str = Field(default=PolicyResetType.ANUAL_CALENDARIO) 
    reset_month: int = Field(default=1) # 1=January
    reset_day: int = Field(default=1)   # 1=1st
    
    max_usos_por_periodo: int | None = Field(default=None) # Start count
    max_days_per_period: float = Field(default=0.0) # Duration limit (renamed from max_days_per_year)
    max_duration_per_day: float | None = Field(default=None) # New: Daily limit (e.g. 1.0 for Lactancia)
    
    validity_window_value: int = Field(default=0)
    validity_window_unit: str = Field(default="months") # months/weeks/days
    
    is_accumulable: bool = Field(default=False)
    accumulable_years: int = Field(default=0)
    
    # Advanced Usage Rules
    allow_split: bool = Field(default=False)
    mandatory_immediate_duration: float = Field(default=0.0)
    split_min_duration: float = Field(default=0.0)
    
    
    # Specifics
    travel_extension_days: float = Field(default=0.0)
    requires_document_type: str | None = None
    
    # Advanced Constraints
    min_advance_notice_days: int = Field(default=0)
    requires_attachment: bool = Field(default=False)
    min_consecutive_days: float | None = Field(default=None)
    max_consecutive_days: float | None = Field(default=None)

    # Casuísticas Avanzadas
    min_seniority_months: int = Field(default=0)               # Meses de antigüedad mínima requerida
    max_days_from_event: int | None = Field(default=None)      # Días máx. desde la fecha causal para iniciar
    justification_deadline_days: int = Field(default=0)        # Días para aportar justificante tras la ausencia
    attachment_type_label: str | None = Field(default=None)    # Instrucción sobre qué documento adjuntar
    mandatory_request_fields: str | None = Field(default=None) # JSON: ["causal_date","child_name",...]
    
    # visual
    color: str | None = "#3B82F6"
    icon: str | None = None
    is_public_dashboard: bool = Field(default=False) # Show in dashboard header?

    # System flags
    is_active: bool = Field(default=True)
    is_featured: bool = Field(default=False)
    is_system_default: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=DateTime(timezone=True))
    
class PermissionPolicyCreate(SQLModel):
    slug: str
    name: str
    description: str | None = None
    duration_value: float
    duration_unit: DurationUnit
    is_paid: bool = True
    requires_justification: bool = True
    modality: Modality = Modality.PRESENCIAL_AUSENTE
    limit_age_child: int | None = None
    
    reset_type: PolicyResetType = PolicyResetType.ANUAL_CALENDARIO
    reset_month: int = 1
    reset_day: int = 1
    max_usos_por_periodo: int | None = None
    max_days_per_period: float = 0.0
    max_duration_per_day: float | None = None
    validity_window_value: int = 0
    validity_window_unit: str = "months"
    is_accumulable: bool = False
    accumulable_years: int = 0
    
    allow_split: bool = False
    mandatory_immediate_duration: float = 0.0
    split_min_duration: float = 0.0
    
    travel_extension_days: float = 0.0
    requires_document_type: str | None = None
    
    min_advance_notice_days: int = 0
    requires_attachment: bool = False
    min_consecutive_days: float | None = None
    max_consecutive_days: float | None = None

    # Casuísticas Avanzadas
    min_seniority_months: int = 0
    max_days_from_event: int | None = None
    justification_deadline_days: int = 0
    attachment_type_label: str | None = None
    mandatory_request_fields: str | None = None
    
    color: str | None = "#3B82F6"
    icon: str | None = None
    is_featured: bool = False
    is_public_dashboard: bool = False

class PermissionPolicyUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    duration_value: float | None = None
    duration_unit: DurationUnit | None = None
    is_paid: bool | None = None
    requires_justification: bool | None = None
    modality: Modality | None = None
    limit_age_child: int | None = None
    
    reset_type: PolicyResetType | None = None
    reset_month: int | None = None
    reset_day: int | None = None
    max_usos_por_periodo: int | None = None
    max_days_per_period: float | None = None
    max_duration_per_day: float | None = None
    validity_window_value: int | None = None
    validity_window_unit: str | None = None
    is_accumulable: bool | None = None
    accumulable_years: int | None = None
    
    allow_split: bool | None = None
    mandatory_immediate_duration: float | None = None
    split_min_duration: float | None = None
    
    travel_extension_days: float | None = None
    requires_document_type: str | None = None
    
    min_advance_notice_days: int | None = None
    requires_attachment: bool | None = None
    min_consecutive_days: float | None = None
    max_consecutive_days: float | None = None

    # Casuísticas Avanzadas
    min_seniority_months: int | None = None
    max_days_from_event: int | None = None
    justification_deadline_days: int | None = None
    attachment_type_label: str | None = None
    mandatory_request_fields: str | None = None
    
    color: str | None = None
    icon: str | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    is_public_dashboard: bool | None = None
