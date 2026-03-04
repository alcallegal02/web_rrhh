from typing import Annotated
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.user as UserService  # Functional Module Import
from app.database import get_session
from app.models.user import User, UserCreate, UserResponse, UserRole, UserUpdate
from app.routers.auth import get_current_user

router = APIRouter(tags=["users"])

@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    # service = UserService(session) # Removed
    actor_role = UserRole(current_user.role)
    if actor_role not in [UserRole.SUPERADMIN, UserRole.RRHH]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
        
    return await UserService.list_users(session, actor_role)



# Modified to use functional service calls
    
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: UserCreate
):
    try:
        logging.info(f"CREATING USER request received. Payload: {payload.model_dump()}")
    except Exception as e:
        logging.error(f"Error logging payload: {e}")
        
    return await UserService.create_user(session, payload, current_user, ip_address=request.client.host)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: str,
    payload: UserUpdate
):
    logging.info(f"UPDATING USER {user_id} with payload: {payload.model_dump()}")
    return await UserService.update_user(session, user_id, payload, current_user, ip_address=request.client.host)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    user_id: str
):
    await UserService.delete_user(session, user_id, current_user, ip_address=request.client.host)


