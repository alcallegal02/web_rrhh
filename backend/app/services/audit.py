from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from typing import Optional, List, Dict, Any
from uuid import UUID
from app.models.audit import AuditLog, AuditLogCreate

async def log_action(
    session: AsyncSession,
    user_id: Optional[UUID],
    action: str,
    module: str,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
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

from sqlalchemy.orm import selectinload

async def get_logs(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    module: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[UUID] = None
) -> List[AuditLog]:
    """Retrieve filtered audit logs with user info"""
    query = select(AuditLog).order_by(desc(AuditLog.created_at)) # .options(selectinload(AuditLog.user))
    
    if module:
        query = query.where(AuditLog.module == module)
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()
