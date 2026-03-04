from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.leave_type import LeaveType, LeaveTypeCreate, LeaveTypeResponse
from app.models.user import User, UserRole
from app.routers.auth import get_current_user

router = APIRouter(prefix="/leave-types", tags=["leave-types"])

@router.get("", response_model=list[LeaveTypeResponse])
async def get_leave_types(
    session: Annotated[AsyncSession, Depends(get_session)],
    active_only: bool = True
):
    query = select(LeaveType)
    if active_only:
        query = query.where(LeaveType.active == True)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=LeaveTypeResponse)
async def create_leave_type(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    leave_type: LeaveTypeCreate
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = LeaveType.model_validate(leave_type)
    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)

    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="CREATE",
        module="TIPOS_PERMISO",
        details={
            "id": str(db_obj.id),
            "name": db_obj.name,
            "days": db_obj.days_allocated
        },
        ip_address=request.client.host
    )

    return db_obj

@router.put("/{type_id}", response_model=LeaveTypeResponse)
async def update_leave_type(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    type_id: UUID,
    leave_type_update: LeaveTypeCreate
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = await session.get(LeaveType, type_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Leave Type not found")
        
    # Capture old state for diffing
    old_state_dict = db_obj.model_dump()

    hero_data = leave_type_update.model_dump(exclude_unset=True)
    for key, value in hero_data.items():
        setattr(db_obj, key, value)
        
    # Audit Log
    from app.services.audit import generate_diff, log_action
    new_state_dict = db_obj.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)

    if diffs:
        await log_action(
            session=session,
            user_id=current_user.id,
            action="UPDATE",
            module="TIPOS_PERMISO",
            details={
                "id": str(type_id),
                "name": db_obj.name,
                "changes": diffs
            },
            ip_address=request.client.host
        )

    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)
    return db_obj

@router.delete("/{type_id}")
async def delete_leave_type(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    type_id: UUID
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = await session.get(LeaveType, type_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Leave Type not found")
        
    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = db_obj.model_dump()
    snapshot['id'] = str(snapshot['id'])
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=current_user.id,
        action="DELETE",
        module="TIPOS_PERMISO",
        details={
            "id": str(type_id),
            "name": db_obj.name,
            "full_snapshot": snapshot
        },
        ip_address=request.client.host
    )

    await session.delete(db_obj)
    await session.commit()
    return {"ok": True}

@router.post("/seed-defaults")
async def seed_defaults(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    defaults = [
        {"name": "Matrimonio", "days_allocated": 15, "is_work_days": False, "requires_justification": True},
        {"name": "Fallecimiento Familiar", "days_allocated": 2, "is_work_days": True, "requires_justification": True},
        {"name": "Mudanza", "days_allocated": 1, "is_work_days": True, "requires_justification": True},
        {"name": "Examen Prenatal", "days_allocated": 0, "is_work_days": True, "requires_justification": True}, # 0 = tiempo indispensable
        {"name": "Deber Inexcusable", "days_allocated": 0, "is_work_days": True, "requires_justification": True},
    ]
    
    created = []
    from app.services.audit import log_action
    for d in defaults:
        # Check if exists
        res = await session.execute(select(LeaveType).where(LeaveType.name == d["name"]))
        if not res.scalar_one_or_none():
            obj = LeaveType(**d)
            session.add(obj)
            created.append(obj)
            
            # Audit each creation in loop (or batch log if preferred)
            # For brevity in log but detail in audit:
            await log_action(
                session=session,
                user_id=current_user.id,
                action="CREATE",
                module="TIPOS_PERMISO",
                details={
                    "id": "SEED",
                    "name": d["name"],
                    "days": d["days_allocated"]
                },
                ip_address=request.client.host
            )
            
    await session.commit()
    return {"created": len(created)}
