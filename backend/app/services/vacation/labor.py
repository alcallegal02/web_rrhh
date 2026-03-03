from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import math
import logging

from app.models.user import User
from app.models.convenio import ConvenioConfig

logger = logging.getLogger(__name__)

def _apply_labor_rights_logic(user: User, config: ConvenioConfig, year: int) -> User:
    """
    Pure logic to calculate labor rights. Modifies the user object in place.
    Does NOT interact with the database.
    """
    # Valid default config logic moved out or assumed config is passed
    if not config:
        # Should rely on caller to provide config, but safe fallback
        valid_start = date(year, 1, 1)
        valid_end = date(year, 12, 31)
        
        # Determine contract days
        contract_start = user.contract_start_date.date() if user.contract_start_date else valid_start
        if contract_start < valid_start: contract_start = valid_start
        
        contract_end = user.contract_expiration_date.date() if user.contract_expiration_date else valid_end
        if contract_end > valid_end: contract_end = valid_end
        
        # ... logic flow repetition implies we should ensure config is always present/derived before calling
        # But for refactor safety, let's keep the logic flow similar to original calculations
        pass

    valid_start = config.valid_from
    valid_end = config.valid_to
    
    contract_start = user.contract_start_date.date() if user.contract_start_date else valid_start
    if contract_start < valid_start:
        contract_start = valid_start
        
    contract_end = user.contract_expiration_date.date() if user.contract_expiration_date else valid_end
    if contract_end > valid_end:
        contract_end = valid_end
        
    if contract_start > valid_end or contract_end < valid_start:
        days_in_contract = 0
    else:
        days_in_contract = (contract_end - contract_start).days + 1

    # Proportion calculation
    total_days_in_period = (valid_end - valid_start).days + 1
    proportion = days_in_contract / float(total_days_in_period) if total_days_in_period > 0 else 0
    if proportion > 1.0:
        proportion = 1.0
        
    # Apply proportion and percentage jornada
    user.vac_days = math.ceil(proportion * config.vacation_days_annual * user.percentage_jornada)
    user.vac_hours = round(user.vac_days * config.daily_work_hours, 3)
    
    # Helper for other rights
    def calc_hours_and_days(annual_hours):
        h = round(proportion * annual_hours * user.percentage_jornada, 4)
        d = round(h / config.daily_work_hours, 4) if config.daily_work_hours > 0 else 0
        return h, d

    user.asuntos_propios_hours, user.asuntos_propios_days = calc_hours_and_days(config.personal_days_hours)
    user.med_gral_hours, user.med_gral_days = calc_hours_and_days(config.medical_general_hours)
    user.med_especialista_hours, user.med_especialista_days = calc_hours_and_days(config.medical_specialist_hours)
    user.dias_compensados_hours, user.dias_compensados_days = calc_hours_and_days(config.compensated_days_hours)
    user.licencia_retribuida_hours, user.licencia_retribuida_days = calc_hours_and_days(config.paid_leave_hours)
    user.bolsa_horas_hours, user.bolsa_horas_days = calc_hours_and_days(config.extra_hours_pool)
    user.horas_sindicales_hours, user.horas_sindicales_days = calc_hours_and_days(config.union_hours)
    
    return user


async def calculate_user_labor_rights(
    session: AsyncSession,
    user: User,
    year: int
) -> User:
    """Calculate and update user labor rights (vacation, AP, etc.) for a specific year"""
    # Fetch config
    result = await session.execute(
        select(ConvenioConfig).where(ConvenioConfig.year_reference == year)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        # Create temp default config for calculation
        config = ConvenioConfig(
            year_reference=year,
            vacation_days_annual=22,
            personal_days_hours=9,
            medical_general_hours=16,
            annual_work_hours=1760,
            daily_work_hours=8.0,
            valid_from=date(year, 1, 1),
            valid_to=date(year, 12, 31),
            # Zeroing out others to be safe or assuming schema defaults
            medical_specialist_hours=0,
            compensated_days_hours=0,
            paid_leave_hours=0,
            extra_hours_pool=0,
            union_hours=0
        )

    _apply_labor_rights_logic(user, config, year)
    
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def recalculate_all_users_labor_rights(
    session: AsyncSession,
    year: int
):
    """
    Recalculate labor rights for all active users for a specific year.
    OPTIMIZED: Batch processing with single commit.
    """
    # 1. Get Config Once
    result = await session.execute(
        select(ConvenioConfig).where(ConvenioConfig.year_reference == year)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        logger.warning(f"No Convenio Config found for {year}. Using defaults for recalculation.")
        config = ConvenioConfig(
            year_reference=year,
            vacation_days_annual=22,
            personal_days_hours=9,
            medical_general_hours=16,
            annual_work_hours=1760,
            daily_work_hours=8.0,
            valid_from=date(year, 1, 1),
            valid_to=date(year, 12, 31),
            medical_specialist_hours=0, compensated_days_hours=0, paid_leave_hours=0, extra_hours_pool=0, union_hours=0
        )

    # 2. Get All Active Users
    result = await session.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    
    # 3. Apply Logic in Memory
    for user in users:
        _apply_labor_rights_logic(user, config, year)
        session.add(user)
    
    # 4. Single Commit
    await session.commit()
    logger.info(f"Recalculated labor rights for {len(users)} users for year {year}")
