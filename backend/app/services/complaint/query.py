from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import desc, select

from app.models.complaint import Complaint


async def get_complaint_by_code(
    session: AsyncSession,
    code: str
) -> Complaint | None:
    """Get a complaint by its unique code (internal/admin)"""
    result = await session.execute(
        select(Complaint)
        .where(Complaint.code == code)
        .options(selectinload(Complaint.attachments))
    )
    return result.scalar_one_or_none()


async def verify_complaint_access(
    session: AsyncSession,
    code: str,
    access_token: str
) -> Complaint | None:
    """Get a complaint ONLY if the access token matches (public)"""
    result = await session.execute(
        select(Complaint)
        .where(
            Complaint.code == code,
            Complaint.access_token == access_token
        )
        .options(selectinload(Complaint.attachments))
    )
    return result.scalar_one_or_none()


async def get_all_complaints(
    session: AsyncSession
) -> list[Complaint]:
    """Get all complaints (for administrators)"""
    result = await session.execute(
        select(Complaint)
        .options(selectinload(Complaint.attachments))
        .order_by(desc(Complaint.created_at))
    )
    return list(result.scalars().all())
