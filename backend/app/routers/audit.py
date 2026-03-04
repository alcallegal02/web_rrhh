from typing import Annotated
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit import AuditLogResponse
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.services.audit import get_logs

router = APIRouter(tags=["audit"])

from datetime import datetime

@router.get("", response_model=list[AuditLogResponse])
async def get_audit_logs(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    skip: int = 0,
    limit: int = 50,
    module: Annotated[list[str] | None, Query(description="Filter by modules")] = None,
    action: Annotated[list[str] | None, Query(description="Filter by actions")] = None,
    target_user_id: Annotated[UUID | None, Query(alias="user_id", description="Filter by user ID")] = None,
    start_date: Annotated[datetime | None, Query(description="Filter by start date")] = None,
    end_date: Annotated[datetime | None, Query(description="Filter by end date")] = None
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
        user_id=target_user_id,
        start_date=start_date,
        end_date=end_date
    )
    return logs
