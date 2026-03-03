from datetime import date, timedelta, datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, col
from app.models.policy import PermissionPolicy, PolicyResetType, DurationUnit
from app.models.vacation import VacationRequest, RequestStatus

class PolicyEngine:
    """
    Engine for calculating policy balances and recurrence windows.
    Refactored 2026.
    """

    @staticmethod
    async def get_policy_balance(
        session: AsyncSession, 
        user_id: str, 
        policy_id: str, 
        target_date: date = date.today()
    ) -> Dict[str, Any]:
        """
        Calculates available balance for a policy at a given date.
        """
        from uuid import UUID
        policy = await session.get(PermissionPolicy, UUID(policy_id) if isinstance(policy_id, str) else policy_id)
        if not policy:
            raise ValueError("Policy not found")

        # 1. Determine Window
        start_date, end_date = await PolicyEngine._calculate_period_window(
            session, user_id, policy, target_date
        )

        # 2. Sum Consumed in Window (returns days)
        consumed, count = await PolicyEngine._calculate_consumed(
             session, user_id, policy_id, start_date, end_date
        )

        # 3. Determine Limit
        limit = 0.0
        if policy.reset_type == PolicyResetType.POR_EVENTO:
            limit = policy.duration_value
            consumed = 0 
        else:
            limit = policy.max_days_per_period if policy.max_days_per_period > 0 else policy.duration_value

        # Fetch daily hours for conversion
        # This is a bit circular but we need it. 
        # Alternatively, assume 8 or fetch from config.
        # For simplicity in this engine, let's try to get it if possible or use 8.0.
        # But wait, balance.py fetches it from ConvenioConfig.
        # Let's fetch it here too.
        from app.models.convenio import ConvenioConfig
        from datetime import date
        config_result = await session.execute(
            select(ConvenioConfig).where(ConvenioConfig.year_reference == date.today().year)
        )
        config = config_result.scalar_one_or_none()
        daily_h = config.daily_work_hours if config else 8.0

        if policy.duration_unit == DurationUnit.HOURS:
            consumed = consumed * daily_h
            # limit is already in hours from duration_value

        return {
            "limit": limit,
            "consumed": consumed,
            "available": max(0, limit - consumed),
            "period_start": start_date,
            "period_end": end_date,
            "reset_type": policy.reset_type,
            "requests_count": count,
            "max_uses": policy.max_usos_por_periodo
        }

    @staticmethod
    async def _calculate_period_window(
        session: AsyncSession, 
        user_id: str, 
        policy: PermissionPolicy, 
        target_date: date
    ) -> Tuple[date, date]:
        
        if policy.reset_type == PolicyResetType.ANUAL_CALENDARIO:
            r_month = policy.reset_month if policy.reset_month else 1
            r_day = policy.reset_day if policy.reset_day else 1
            
            try:
                current_year_reset = date(target_date.year, r_month, r_day)
            except ValueError:
                current_year_reset = date(target_date.year, r_month, 28)

            if target_date < current_year_reset:
                start = date(target_date.year - 1, r_month, r_day)
                end = current_year_reset - timedelta(days=1)
            else:
                start = current_year_reset
                next_year_reset = date(target_date.year + 1, r_month, r_day)
                end = next_year_reset - timedelta(days=1)
                
            return start, end

        elif policy.reset_type == PolicyResetType.ANUAL_RELATIVO:
            result = await session.execute(
                select(VacationRequest)
                .where(VacationRequest.user_id == user_id)
                .where(VacationRequest.policy_id == policy.id)
                .where(VacationRequest.status == RequestStatus.ACCEPTED)
                .order_by(VacationRequest.start_date)
            )
            requests = result.scalars().all()

            current_cycle_start = None
            current_cycle_end = None
            
            for req in requests:
                req_start = req.start_date
                if isinstance(req_start, datetime): req_start = req_start.date()
                
                if current_cycle_start is None:
                    current_cycle_start = req_start
                    current_cycle_end = req_start + timedelta(days=365)
                
                if req_start <= current_cycle_end:
                    pass
                else:
                    if target_date <= current_cycle_end:
                        return current_cycle_start, current_cycle_end
                    
                    current_cycle_start = req_start
                    current_cycle_end = req_start + timedelta(days=365)
            
            if current_cycle_start and target_date <= current_cycle_end:
                return current_cycle_start, current_cycle_end
            
            return target_date, target_date + timedelta(days=365)

        elif policy.reset_type == PolicyResetType.SIN_REINICIO:
             return date(2000, 1, 1), date(2100, 1, 1)

        else: 
             return date(target_date.year, 1, 1), date(target_date.year, 12, 31)

    @staticmethod
    async def _calculate_consumed(
        session: AsyncSession, 
        user_id: str, 
        policy_id: str, 
        start: date, 
        end: date
    ) -> Tuple[float, int]:
        
        statement = select(VacationRequest).where(
            VacationRequest.user_id == user_id,
            VacationRequest.policy_id == policy_id,
            VacationRequest.status == RequestStatus.ACCEPTED,
            VacationRequest.start_date >= start,
            VacationRequest.start_date <= end 
        )
        result = await session.execute(statement)
        results = result.scalars().all()
        
        total_days = sum(r.days_requested for r in results) 
        count = len(results)
        
        return total_days, count
