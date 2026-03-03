from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.holiday import Holiday, HolidayCreate, HolidayUpdate


async def create_holiday(
    session: AsyncSession,
    holiday_data: HolidayCreate,
    created_by: str
) -> Holiday:
    """Create a new holiday"""
    created_by_uuid = UUID(created_by) if isinstance(created_by, str) else created_by
    holiday = Holiday(
        **holiday_data.dict(),
        created_by=created_by_uuid
    )
    session.add(holiday)
    await session.commit()
    await session.refresh(holiday)
    return holiday


async def get_all_holidays(
    session: AsyncSession,
    year: Optional[int] = None
) -> List[Holiday]:
    """Get all holidays, optionally filtered by year"""
    query = select(Holiday)
    if year:
        query = query.where(
            Holiday.date >= date(year, 1, 1),
            Holiday.date < date(year + 1, 1, 1)
        )
    query = query.order_by(Holiday.date)
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_holiday_by_id(
    session: AsyncSession,
    holiday_id: str
) -> Optional[Holiday]:
    """Get a holiday by ID"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    return result.scalar_one_or_none()



async def delete_holiday(
    session: AsyncSession,
    holiday_id: str
) -> bool:
    """Delete a holiday"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        return False
    
    await session.delete(holiday)
    await session.commit()
    return True


async def update_holiday(
    session: AsyncSession,
    holiday_id: str,
    update_data: HolidayUpdate
) -> Optional[Holiday]:
    """Update a holiday"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        return None
    
    data_dict = update_data.dict(exclude_unset=True)
    for key, value in data_dict.items():
        setattr(holiday, key, value)
        
    session.add(holiday)
    await session.commit()
    await session.refresh(holiday)
    return holiday


