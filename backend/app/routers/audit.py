from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_session
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.models.audit import AuditLogResponse
from app.services.audit import get_logs

router = APIRouter(tags=["audit"])

@router.get("", response_model=List[AuditLogResponse])
async def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    module: Optional[str] = Query(None, description="Filter by module"),
    action: Optional[str] = Query(None, description="Filter by action"),
    target_user_id: Optional[UUID] = Query(None, alias="user_id", description="Filter by user ID"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get audit history.
    Restricted to Superadmin and RRHH.
    """
    if current_user.role_enum not in [UserRole.SUPERADMIN, UserRole.RRHH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view audit logs"
        )
        
    logs = await get_logs(
        session=session, 
        skip=skip, 
        limit=limit, 
        module=module, 
        action=action, 
        user_id=target_user_id
    )
    return logs
