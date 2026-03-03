from typing import List, Optional
from sqlmodel import SQLModel
from uuid import UUID

class PolicyBalance(SQLModel):
    policy_id: UUID
    slug: str
    name: str
    # Limits
    max_duration: float
    unit: str
    
    # State
    total_days: float # Global limit per year if applicable
    used_days: float
    pending_days: float
    available_days: float
    
    # Display values (in native units: hours or days)
    total_value: float
    available_value: float
    
    is_public_dashboard: bool = True
    is_featured: bool = False

class VacationBalanceResponse(SQLModel):
    daily_work_hours: float
    balances: List[PolicyBalance]
