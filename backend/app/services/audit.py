from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import desc, select

from app.models.audit import AuditLog


def generate_diff(old_obj_dict: dict[str, Any], new_data_dict: dict[str, Any], exclude: list[str] | None = None) -> dict[str, Any]:
    """
    Generate a diff dictionary between an old object dictionary and new data.
    """
    diffs = {}
    exclude = exclude or ["id", "created_at", "updated_at", "updated_by", "created_by"]
    
    for key, new_value in new_data_dict.items():
        if key in exclude:
            continue
            
        old_value = old_obj_dict.get(key)
        
        # Normalize for comparison
        s_old = str(old_value) if isinstance(old_value, (UUID, datetime, date)) else old_value
        s_new = str(new_value) if isinstance(new_value, (UUID, datetime, date)) else new_value
        
        if s_old != s_new:
            diffs[key] = {"old": s_old, "new": s_new}
            
    return diffs


async def log_action(
    session: AsyncSession,
    user_id: UUID | None,
    action: str,
    module: str,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None
) -> AuditLog:
    """
    Record an action in the audit log.
    
    Args:
        session: Database session
        user_id: ID of the user performing the action (None for anonymous)
        action: Short description of action (e.g. CREATE, UPDATE, DELETE)
        module: Affected module (e.g. NEWS, COMPLAINT)
        details: Additional metadata
        ip_address: Client IP
    """
    audit = AuditLog(
        user_id=user_id,
        action=action,
        module=module,
        details=details,
        ip_address=ip_address
    )
    session.add(audit)
    await session.commit()
    await session.refresh(audit)
    return audit



async def get_logs(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    module: list[str] | None = None,
    action: list[str] | None = None,
    user_id: UUID | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None
) -> list[AuditLog]:
    """Retrieve filtered audit logs with user info"""
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    
    if module:
        query = query.where(AuditLog.module.in_(module))
    if action:
        query = query.where(AuditLog.action.in_(action))
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
        
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()
