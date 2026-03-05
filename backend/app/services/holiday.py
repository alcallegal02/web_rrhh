from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.holiday import Holiday, HolidayCreate, HolidayUpdate


async def create_holiday(
    session: AsyncSession,
    holiday_data: HolidayCreate,
    created_by: str,
    ip_address: str | None = None
) -> Holiday:
    """Create a new holiday"""
    created_by_uuid = UUID(created_by) if isinstance(created_by, str) else created_by
    holiday = Holiday(
        **holiday_data.model_dump(),
        created_by=created_by_uuid
    )
    session.add(holiday)
    await session.commit()
    await session.refresh(holiday)
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=created_by_uuid,
        action="CREATE",
        module="FESTIVOS",
        details={
            "id": str(holiday.id),
            "name": holiday.name,
            "date": str(holiday.date),
            "holiday_type": holiday.holiday_type
        },
        ip_address=ip_address
    )
    
    return holiday


async def get_all_holidays(
    session: AsyncSession,
    year: int | None = None
) -> list[Holiday]:
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
) -> Holiday | None:
    """Get a holiday by ID"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    return result.scalar_one_or_none()



async def delete_holiday(
    session: AsyncSession,
    holiday_id: str,
    user_id: str | None = None,
    ip_address: str | None = None
) -> bool:
    """Delete a holiday"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        return False
    
    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = holiday.model_dump()
    snapshot['id'] = str(snapshot['id'])
    snapshot['date'] = str(snapshot['date'])
    snapshot['created_by'] = str(snapshot['created_by'])
    if snapshot.get('created_at'):
        snapshot['created_at'] = snapshot['created_at'].isoformat()
    if snapshot.get('updated_at'):
        snapshot['updated_at'] = snapshot['updated_at'].isoformat()
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=UUID(user_id) if user_id else None,
        action="DELETE",
        module="FESTIVOS",
        details={
            "id": holiday_id,
            "name": holiday.name,
            "full_snapshot": snapshot
        },
        ip_address=ip_address
    )
    
    await session.delete(holiday)
    await session.commit()
    return True


async def update_holiday(
    session: AsyncSession,
    holiday_id: str,
    update_data: HolidayUpdate,
    user_id: str | None = None,
    ip_address: str | None = None
) -> Holiday | None:
    """Update a holiday"""
    holiday_uuid = UUID(holiday_id) if isinstance(holiday_id, str) else holiday_id
    result = await session.execute(
        select(Holiday).where(Holiday.id == holiday_uuid)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        return None
    
    # Capture old state for diffing
    old_state_dict = holiday.model_dump()
    
    data_dict = update_data.model_dump(exclude_unset=True)
    for key, value in data_dict.items():
        setattr(holiday, key, value)
    
    # Audit Log
    from app.services.audit import generate_diff, log_action
    
    new_state_dict = holiday.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)
    
    if diffs:
        await log_action(
            session=session,
            user_id=UUID(user_id) if user_id else None,
            action="UPDATE",
            module="FESTIVOS",
            details={
                "id": holiday_id,
                "name": holiday.name,
                "changes": diffs
            },
            ip_address=ip_address
        )
        
    session.add(holiday)
    await session.commit()
    await session.refresh(holiday)
    return holiday


