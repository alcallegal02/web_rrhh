from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.models.leave_type import LeaveType, LeaveTypeCreate, LeaveTypeResponse

router = APIRouter(prefix="/leave-types", tags=["leave-types"])

@router.get("", response_model=List[LeaveTypeResponse])
async def get_leave_types(
    session: AsyncSession = Depends(get_session),
    active_only: bool = True
):
    query = select(LeaveType)
    if active_only:
        query = query.where(LeaveType.active == True)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=LeaveTypeResponse)
async def create_leave_type(
    leave_type: LeaveTypeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = LeaveType.model_validate(leave_type)
    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)
    return db_obj

@router.put("/{type_id}", response_model=LeaveTypeResponse)
async def update_leave_type(
    type_id: UUID,
    leave_type_update: LeaveTypeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = await session.get(LeaveType, type_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Leave Type not found")
        
    hero_data = leave_type_update.model_dump(exclude_unset=True)
    for key, value in hero_data.items():
        setattr(db_obj, key, value)
        
    session.add(db_obj)
    await session.commit()
    await session.refresh(db_obj)
    return db_obj

@router.delete("/{type_id}")
async def delete_leave_type(
    type_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_obj = await session.get(LeaveType, type_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Leave Type not found")
        
    # Soft delete? Or hard delete? Hard delete for now, assuming no FK constraints blocking yet
    # Or set active=False
    session.add(db_obj) 
    await session.delete(db_obj)
    await session.commit()
    return {"ok": True}

@router.post("/seed-defaults")
async def seed_defaults(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
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
    for d in defaults:
        # Check if exists
        res = await session.execute(select(LeaveType).where(LeaveType.name == d["name"]))
        if not res.scalar_one_or_none():
            obj = LeaveType(**d)
            session.add(obj)
            created.append(obj)
            
    await session.commit()
    return {"created": len(created)}
