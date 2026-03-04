from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.convenio import (
    ConvenioConfig,
    ConvenioConfigCreate,
    ConvenioConfigUpdate,
)
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.convenio import ConvenioService

router = APIRouter(prefix="/convenio", tags=["convenio"])

@router.get("/", response_model=list[ConvenioConfig])
async def get_all_convenio_configs(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get all convenio configurations"""
    return await ConvenioService.get_all(session)

@router.get("/{year}", response_model=ConvenioConfig)
async def get_convenio_config_by_year(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    year: int
):
    """Get convenio configuration for a specific year"""
    return await ConvenioService.get_by_year(session, year)

@router.post("/", response_model=ConvenioConfig)
async def create_convenio_config(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
    config_in: ConvenioConfigCreate
):
    """Create a new convenio configuration (RRHH only)"""
    return await ConvenioService.create(session, config_in, current_user, request.client.host)

@router.patch("/{id}", response_model=ConvenioConfig)
async def update_convenio_config(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
    id: UUID,
    config_in: ConvenioConfigUpdate
):
    """Update an existing convenio configuration (RRHH only)"""
    return await ConvenioService.update(session, id, config_in, current_user, request.client.host)
