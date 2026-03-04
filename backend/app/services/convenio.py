from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.convenio import (
    ConvenioConfig,
    ConvenioConfigCreate,
    ConvenioConfigUpdate,
)
from app.models.user import User, UserRole
from app.services.audit import log_action
from app.services.vacation import recalculate_all_users_labor_rights


class ConvenioService:
    @staticmethod
    async def get_all(session: AsyncSession) -> list[ConvenioConfig]:
        result = await session.execute(select(ConvenioConfig).order_by(ConvenioConfig.year_reference.desc()))
        return result.scalars().all()

    @staticmethod
    async def get_by_year(session: AsyncSession, year: int) -> ConvenioConfig:
        result = await session.execute(select(ConvenioConfig).where(ConvenioConfig.year_reference == year))
        config = result.scalar_one_or_none()
        if not config:
            raise HTTPException(status_code=404, detail=f"Config for year {year} not found")
        return config

    @staticmethod
    async def create(session: AsyncSession, config_in: ConvenioConfigCreate, current_user: User, ip_address: str | None = None) -> ConvenioConfig:
        if current_user.role not in [UserRole.RRHH.value, UserRole.SUPERADMIN.value]:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        # Check existence
        existing = await session.execute(select(ConvenioConfig).where(ConvenioConfig.year_reference == config_in.year_reference))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Config for year {config_in.year_reference} already exists")

        config = ConvenioConfig(**config_in.model_dump())
        session.add(config)
        await session.commit()
        await session.refresh(config)

        # Side Effects
        await recalculate_all_users_labor_rights(session, config.year_reference)

        await log_action(
            session,
            user_id=current_user.id,
            action="CREATE",
            module="CONVENIO",
            details={
                "id": str(config.id),
                "year": config.year_reference,
                "annual_vacation_days": config.annual_vacation_days,
                "max_carryover_days": config.max_carryover_days
            },
            ip_address=ip_address
        )
        return config

    @staticmethod
    async def update(session: AsyncSession, id: UUID, config_in: ConvenioConfigUpdate, current_user: User, ip_address: str | None = None) -> ConvenioConfig:
        if current_user.role not in [UserRole.RRHH.value, UserRole.SUPERADMIN.value]:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        result = await session.execute(select(ConvenioConfig).where(ConvenioConfig.id == id))
        config = result.scalar_one_or_none()
        if not config:
            raise HTTPException(status_code=404, detail="Config not found")

        # Capture old state for diffing
        old_state_dict = config.model_dump()

        update_data = config_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(config, key, value)
        
        config.updated_at = datetime.utcnow()
        
        # Audit Log
        from app.services.audit import generate_diff
        new_state_dict = config.model_dump()
        diffs = generate_diff(old_state_dict, new_state_dict)

        if diffs:
            await log_action(
                session,
                user_id=current_user.id,
                action="UPDATE",
                module="CONVENIO",
                details={
                    "id": str(config.id), 
                    "year": config.year_reference, 
                    "changes": diffs
                },
                ip_address=ip_address
            )

        session.add(config)
        await session.commit()
        await session.refresh(config)

        # Side Effects
        await recalculate_all_users_labor_rights(session, config.year_reference)

        return config
