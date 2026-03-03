from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.models.news import News, NewsStatus

async def get_all_news(
    session: AsyncSession,
    user_role: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> List[News]:
    """Get news - with automatic status filtering based on role"""
    from app.models.user import UserRole
    
    query = select(News).options(selectinload(News.attachments))
    
    # Secure filtering logic
    is_privileged = user_role in [UserRole.RRHH.value, UserRole.SUPERADMIN.value]
    
    if not is_privileged:
        # Employees MUST ONLY see published news
        query = query.where(News.status == NewsStatus.PUBLICADA.value)
    elif status:
        # Admins can filter by a specific status if requested
        query = query.where(News.status == status)
        
    # Ordering: published first if no specific admin ordering is needed
    if not is_privileged or status == NewsStatus.PUBLICADA.value:
        query = query.order_by(News.publish_date.desc(), News.created_at.desc())
    else:
        query = query.order_by(News.created_at.desc())
        
    query = query.limit(limit).offset(offset)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_latest_published_news(
    session: AsyncSession
) -> Optional[News]:
    """Get the latest published news"""
    result = await session.execute(
        select(News)
        .where(News.status == NewsStatus.PUBLICADA.value)
        .options(selectinload(News.attachments))
        .order_by(News.publish_date.desc(), News.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_news_by_id(
    session: AsyncSession,
    news_id: str,
    user_role: Optional[str] = None
) -> Optional[News]:
    """Get news by ID with optional status security check"""
    from app.models.user import UserRole
    
    news_uuid = UUID(news_id) if isinstance(news_id, str) else news_id
    query = select(News).where(News.id == news_uuid).options(selectinload(News.attachments))
    
    # Secure individual retrieval
    if user_role not in [UserRole.RRHH.value, UserRole.SUPERADMIN.value]:
        query = query.where(News.status == NewsStatus.PUBLICADA.value)
        
    result = await session.execute(query)
    return result.scalar_one_or_none()


# Deprecated but kept for compatibility if needed elsewhere
async def get_all_published_news(session: AsyncSession) -> List[News]:
    from app.models.user import UserRole
    return await get_all_news(session, user_role=UserRole.EMPLEADO.value)
