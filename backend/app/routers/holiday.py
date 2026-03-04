from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.holiday import HolidayCreate, HolidayResponse, HolidayUpdate
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.services.holiday import (
    create_holiday,
    delete_holiday,
    get_all_holidays,
    update_holiday,
)

router = APIRouter(tags=["holiday"])


@router.post("", response_model=HolidayResponse)
async def create_holiday_endpoint(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    holiday_data: HolidayCreate
):
    """Create a new holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can create holidays"
        )
    
    holiday = await create_holiday(session, holiday_data, str(current_user.id), ip_address=request.client.host)
    # Convert UUIDs to strings for response
    holiday_dict = holiday.model_dump()
    holiday_dict['id'] = str(holiday_dict['id'])
    holiday_dict['created_by'] = str(holiday_dict['created_by'])
    
    # Broadcast create event
    from app.websocket.manager import websocket_manager
    await websocket_manager.broadcast({
        "type": "HOLIDAY_CREATED",
        "data": holiday_dict
    })
    
    return HolidayResponse.model_validate(holiday_dict)


@router.get("", response_model=list[HolidayResponse])
async def get_holidays(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    year: Annotated[int | None, Query(description="Filter by year")] = None
):
    """Get all holidays, optionally filtered by year"""
    holidays = await get_all_holidays(session, year)
    # Convert UUIDs to strings for response
    response_list = []
    for holiday in holidays:
        holiday_dict = holiday.model_dump()
        holiday_dict['id'] = str(holiday_dict['id'])
        holiday_dict['created_by'] = str(holiday_dict['created_by'])
        response_list.append(HolidayResponse.model_validate(holiday_dict))
    return response_list


@router.delete("/{holiday_id}")
async def delete_holiday_endpoint(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    holiday_id: str
):
    """Delete a holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can delete holidays"
        )
    
    deleted = await delete_holiday(session, holiday_id, user_id=str(current_user.id), ip_address=request.client.host)
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
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    holiday_id: str,
    holiday_data: HolidayUpdate
):
    """Update a holiday (RRHH or SUPERADMIN)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH or Superadmin can update holidays"
        )
    
    holiday = await update_holiday(session, holiday_id, holiday_data, user_id=str(current_user.id), ip_address=request.client.host)
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found"
        )
    
    # Broadcast update event
    from app.websocket.manager import websocket_manager
    holiday_dict = holiday.model_dump()
    holiday_dict['id'] = str(holiday_dict['id'])
    holiday_dict['created_by'] = str(holiday_dict['created_by'])
    
    await websocket_manager.broadcast({
        "type": "HOLIDAY_UPDATED",
        "data": holiday_dict
    })
    
    return HolidayResponse.model_validate(holiday_dict)

