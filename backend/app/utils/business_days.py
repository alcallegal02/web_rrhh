from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.holiday import Holiday


async def get_business_days_count(
    session: AsyncSession,
    start_date: date,
    end_date: date
) -> float:
    """
    Calculates the number of business days between start_date and end_date (inclusive).
    Excludes weekends (Saturday, Sunday) and holidays from the 'holidays' table.
    """
    if start_date > end_date:
        return 0.0

    # Fetch holidays in the range
    result = await session.execute(
        select(Holiday).where(
            Holiday.date >= start_date,
            Holiday.date <= end_date
        )
    )
    holidays = result.scalars().all()
    holiday_dates = {h.date for h in holidays}

    count = 0
    current_date = start_date
    while current_date <= end_date:
        # 5 is Saturday, 6 is Sunday in Python's weekday()
        if current_date.weekday() < 5 and current_date not in holiday_dates:
            count += 1
        current_date += timedelta(days=1)

    return float(count)
