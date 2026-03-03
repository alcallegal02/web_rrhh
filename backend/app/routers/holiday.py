from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.models.holiday import (
    Holiday,
    HolidayCreate,
    HolidayResponse,
    HolidayUpdate
)
from app.services.holiday import (
    create_holiday,
    get_all_holidays,
    get_holiday_by_id,
    delete_holiday,
    update_holiday
)

router = APIRouter(tags=["holiday"])


@router.post("", response_model=HolidayResponse)
async def create_holiday_endpoint(
    holiday_data: HolidayCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Create a new holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can create holidays"
        )
    
    holiday = await create_holiday(session, holiday_data, str(current_user.id))
    # Convert UUIDs to strings for response
    holiday_dict = holiday.dict()
    holiday_dict['id'] = str(holiday_dict['id'])
    holiday_dict['created_by'] = str(holiday_dict['created_by'])
    
    # Broadcast create event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "HOLIDAY_CREATED",
        "data": holiday_dict
    })
    
    return HolidayResponse.model_validate(holiday_dict)


@router.get("", response_model=List[HolidayResponse])
async def get_holidays(
    year: Optional[int] = Query(None, description="Filter by year"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get all holidays, optionally filtered by year"""
    holidays = await get_all_holidays(session, year)
    # Convert UUIDs to strings for response
    response_list = []
    for holiday in holidays:
        holiday_dict = holiday.dict()
        holiday_dict['id'] = str(holiday_dict['id'])
        holiday_dict['created_by'] = str(holiday_dict['created_by'])
        response_list.append(HolidayResponse.model_validate(holiday_dict))
    return response_list


@router.delete("/{holiday_id}")
async def delete_holiday_endpoint(
    holiday_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Delete a holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can delete holidays"
        )
    
    deleted = await delete_holiday(session, holiday_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found"
        )
    
    # Broadcast delete event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "HOLIDAY_DELETED",
        "id": holiday_id
    })
    
    return {"message": "Holiday deleted successfully"}


@router.put("/{holiday_id}", response_model=HolidayResponse)
async def update_holiday_endpoint(
    holiday_id: str,
    holiday_data: HolidayUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update a holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can update holidays"
        )
    
    holiday = await update_holiday(session, holiday_id, holiday_data)
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found"
        )
    
    # Broadcast update event
    from app.websocket.manager import websocket_manager
    holiday_dict = holiday.dict()
    holiday_dict['id'] = str(holiday_dict['id'])
    holiday_dict['created_by'] = str(holiday_dict['created_by'])
    
    await websocket_manager.broadcast({
        "type": "HOLIDAY_UPDATED",
        "data": holiday_dict
    })
    
    return HolidayResponse.model_validate(holiday_dict)

