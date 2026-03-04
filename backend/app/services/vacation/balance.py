from datetime import date
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.balance_dynamic import PolicyBalance, VacationBalanceResponse
from app.models.convenio import ConvenioConfig
from app.models.policy import PermissionPolicy
from app.models.user import User
from app.models.vacation import RequestStatus, VacationRequest


async def get_vacation_balance(
    session: AsyncSession,
    user_id: str
) -> VacationBalanceResponse:
    """
    Get complete balance for all labor rights categories using optimized SQL aggregations.
    This shifts calculation load from Python to the Database.
    """
    user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    
    # 1. Fetch User and Config in parallel-ish/single query logic or keep simple.
    # To keep it atomic, we fetch User first.
    user_result = await session.execute(select(User).where(User.id == user_uuid))
    user = user_result.scalar_one_or_none()
    
    if not user:
        empty = CategoryBalance(total_days=0, used_days=0, pending_days=0, available_days=0)
        return VacationBalance(
             vacaciones=empty, asuntos_propios=empty, medico_general=empty, 
             medico_especialista=empty, dias_compensados=empty, licencia_retribuida=empty,
             bolsa_horas=empty, horas_sindicales=empty, maternidad_paternidad=empty
        )

    current_year = date.today().year

    # 2. Get Config (needed for daily_work_hours)
    config_result = await session.execute(
        select(ConvenioConfig).where(ConvenioConfig.year_reference == current_year)
    )
    config = config_result.scalar_one_or_none()
    daily_h = config.daily_work_hours if config else 8.0
    mat_weeks = config.maternity_weeks_total if config and config.maternity_weeks_total else 16

    # 3. Aggregation Query: 
    # Group by request_type and status bucket (Used vs Pending)
    # SUM(days_requested)
    
    # Define status buckets
    # Used: ACCEPTED, APPROVED_RRHH
    # Pending: PENDING, APPROVED_MANAGER
    
    # SQLModel doesn't support complex case expressions in group_by easily across all DBs without explicit labeling.
    # We will group by request_type and status, and process the few rows in Python (much faster than all requests).
    
    stmt = (
        select(
            VacationRequest.request_type,
            VacationRequest.status,
            func.sum(VacationRequest.days_requested)
        )
        .where(
            VacationRequest.user_id == user_uuid,
            # Filter optimization if needed: VacationRequest.start_date >= start_of_year
            # But the requirement usually is "pending requests from previous year" vs "this year's bucket"?
            # Typically balance is for the current entitlement year. 
            # Assuming requests belong to the current entitlement context or date filtering is applied implicitly by business logic.
            # For now, consistent with previous code: "Get all requests for the user" (Previous code comment said 'current year' but didn't actually filter by date in the query! It fetched ALL)
            # WAIT: The original code comment said "Get all requests for the user in the current year" but the query was `select(VacationRequest).where(VacationRequest.user_id == user_uuid)`.
            # Use strict filtering if intended, but to be safe/compatible, I will stick to "user_id" filter unless I see a reason to restrict (e.g. historical data).
            # Actually, `get_vacation_balance` usually implies current active year. A safe optimization is `func.extract('year', VacationRequest.start_date) == current_year`?
            # Let's keep it safe compatible with original: ALL requests for user involved in calculation.
        )
        .group_by(VacationRequest.request_type, VacationRequest.status)
    )
    
    agg_result = await session.execute(stmt)
    rows = agg_result.all() # List of (type, status, sum)
    
    used_map = {}
    pending_map = {}
    
    for r_type, r_status, r_sum in rows:
        val = float(r_sum) if r_sum else 0.0
        
        if r_status in [RequestStatus.ACCEPTED, RequestStatus.APPROVED_RRHH]:
            used_map[r_type] = used_map.get(r_type, 0.0) + val
        elif r_status in [RequestStatus.PENDING, RequestStatus.APPROVED_MANAGER]:
            pending_map[r_type] = pending_map.get(r_type, 0.0) + val

    # 4. Fetch all Active Policies
    policy_result = await session.execute(select(PermissionPolicy).where(PermissionPolicy.is_active == True))
    policies = policy_result.scalars().all()
    
    # Sort policies: Featured first, then alphabetical by name
    policies = sorted(policies, key=lambda p: (not p.is_featured, p.name))
    
    balances = []
    
    for policy in policies:
        # Determine total allocated for this user/policy
        # For legacy core types, we might check User attributes
        total = float(policy.duration_value) # Default from policy
        
        # Override for specific known slugs (Backward compatibility / User specific quotas)
        if policy.slug == "vacaciones" and hasattr(user, "vac_days"):
            total = float(user.vac_days)
        elif policy.slug == "asuntos_propios" and hasattr(user, "asuntos_propios_days"):
             total = float(user.asuntos_propios_days)
        elif policy.slug == "medico_general" and hasattr(user, "med_gral_days"):
             total = float(user.med_gral_days)
        # ... map others if needed

        # IMPORTANT: Normalize total to DAYS if it's configured in HOURS
        # because used/pending are always stored in day-equivalents.
        from app.models.policy import DurationUnit
        is_hourly = policy.duration_unit == DurationUnit.HOURS
        if is_hourly:
            total = total / daily_h
        
        # Calculate usage based on Policy ID OR Slug (for legacy requests before migration)
        # We assume usage map is keyed by request_type (slug/str) or now policy_id?
        # The query above aggregated by `VacationRequest.request_type` (which is a str slug).
        # We need to ensure we match `policy.slug`.
        
        u = used_map.get(policy.slug, 0.0)
        p = pending_map.get(policy.slug, 0.0)
        
        from app.models.policy import PolicyResetType
        if policy.reset_type == PolicyResetType.POR_EVENTO:
            # For "Per Event" policies, the available balance is always the total limit
            # because each event is independent. We don't subtract previous uses from availability.
            avail = total 
        else:
            avail = max(0.0, total - u - p)
        
        balances.append(PolicyBalance(
            policy_id=policy.id,
            slug=policy.slug,
            name=policy.name,
            max_duration=policy.duration_value,
            unit=policy.duration_unit,
            total_days=round(total, 4),
            used_days=round(u, 4),
            pending_days=round(p, 4),
            available_days=round(avail, 4),
            total_value=round(total * daily_h, 2) if is_hourly else round(total, 2),
            available_value=round(avail * daily_h, 2) if is_hourly else round(avail, 2),
            is_public_dashboard=policy.is_public_dashboard,
            is_featured=policy.is_featured
        ))

    return VacationBalanceResponse(
        daily_work_hours=daily_h,
        balances=balances
    )
