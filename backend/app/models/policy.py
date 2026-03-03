from sqlmodel import SQLModel, Field
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
from enum import Enum

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
    description: Optional[str] = None
    
    # Duration Rules
    duration_value: float 
    duration_unit: str = Field(default=DurationUnit.DAYS_NATURAL) 
    
    # Configuration
    is_paid: bool = Field(default=True)
    requires_justification: bool = Field(default=True)
    modality: str = Field(default=Modality.PRESENCIAL_AUSENTE)
    limit_age_child: Optional[int] = None
    
    # Recurrence & Lifecycle (Refactor 2026)
    reset_type: str = Field(default=PolicyResetType.ANUAL_CALENDARIO) 
    reset_month: int = Field(default=1) # 1=January
    reset_day: int = Field(default=1)   # 1=1st
    
    max_usos_por_periodo: Optional[int] = Field(default=None) # Start count
    max_days_per_period: float = Field(default=0.0) # Duration limit (renamed from max_days_per_year)
    max_duration_per_day: Optional[float] = Field(default=None) # New: Daily limit (e.g. 1.0 for Lactancia)
    
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
    requires_document_type: Optional[str] = None
    
    # visual
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = None
    is_public_dashboard: bool = Field(default=False) # Show in dashboard header?

    # System flags
    is_active: bool = Field(default=True)
    is_featured: bool = Field(default=False)
    is_system_default: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
class PermissionPolicyCreate(SQLModel):
    slug: str
    name: str
    description: Optional[str] = None
    duration_value: float
    duration_unit: DurationUnit
    is_paid: bool = True
    requires_justification: bool = True
    modality: Modality = Modality.PRESENCIAL_AUSENTE
    limit_age_child: Optional[int] = None
    
    reset_type: PolicyResetType = PolicyResetType.ANUAL_CALENDARIO
    reset_month: int = 1
    reset_day: int = 1
    max_usos_por_periodo: Optional[int] = None
    max_days_per_period: float = 0.0
    max_duration_per_day: Optional[float] = None
    validity_window_value: int = 0
    validity_window_unit: str = "months"
    is_accumulable: bool = False
    accumulable_years: int = 0
    
    allow_split: bool = False
    mandatory_immediate_duration: float = 0.0
    split_min_duration: float = 0.0
    
    travel_extension_days: float = 0.0
    requires_document_type: Optional[str] = None
    
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = None
    is_featured: bool = False
    is_public_dashboard: bool = False

class PermissionPolicyUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_value: Optional[float] = None
    duration_unit: Optional[DurationUnit] = None
    is_paid: Optional[bool] = None
    requires_justification: Optional[bool] = None
    modality: Optional[Modality] = None
    limit_age_child: Optional[int] = None
    
    reset_type: Optional[PolicyResetType] = None
    reset_month: Optional[int] = None
    reset_day: Optional[int] = None
    max_usos_por_periodo: Optional[int] = None
    max_days_per_period: Optional[float] = None
    max_duration_per_day: Optional[float] = None
    validity_window_value: Optional[int] = None
    validity_window_unit: Optional[str] = None
    is_accumulable: Optional[bool] = None
    accumulable_years: Optional[int] = None
    
    allow_split: Optional[bool] = None
    mandatory_immediate_duration: Optional[float] = None
    split_min_duration: Optional[float] = None
    
    travel_extension_days: Optional[float] = None
    requires_document_type: Optional[str] = None
    
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_public_dashboard: Optional[bool] = None
