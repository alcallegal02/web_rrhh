from datetime import datetime
from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.news import NewsCreate, NewsResponse, NewsUpdate
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.services.news import (
    create_news,
    delete_news,
    get_all_news,
    get_latest_published_news,
    get_news_by_id,
    update_news,
    update_news_status,
)

router = APIRouter(tags=["news"])
limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=NewsResponse)
@limiter.limit("5/minute")
async def create_news_item(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    news_data: NewsCreate
):
    """Create a new news item (RRHH/admin/superadmin)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can create news"
        )
    
    news = await create_news(session, str(current_user.id), news_data, background_tasks=background_tasks, ip_address=request.client.host)
    return NewsResponse.model_validate(news)


@router.get("", response_model=list[NewsResponse])
async def get_news(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    status: Annotated[list[str] | None, Query(description="Filter by status: borrador, publicada, archivada")] = None,
    start_date: Annotated[datetime | None, Query()] = None,
    end_date: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0
):
    """Get news - with automatic status filtering based on role"""
    news_list = await get_all_news(
        session, 
        user_role=current_user.role, 
        statuses=status,
        start_date=start_date,
        end_date=end_date,
        limit=limit, 
        offset=offset
    )
    
    return [NewsResponse.model_validate(news) for news in news_list]


@router.get("/latest", response_model=Optional[NewsResponse])
async def get_latest_news_item(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """Get the most recent published news article (for dashboard popup)"""
    news = await get_latest_published_news(session)
    if not news:
        return None
    return NewsResponse.model_validate(news)


@router.patch("/{news_id}/status")
@limiter.limit("10/minute")
async def update_news_status_endpoint(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    news_id: str,
    new_status: Annotated[str, Query(description="New status: borrador, publicada, archivada")]
):
    """Update news status (RRHH/superadmin)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can update news status"
        )
    
    if new_status not in ['borrador', 'publicada', 'archivada']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be one of: borrador, publicada, archivada"
        )
    
    news = await update_news_status(session, news_id, new_status, user_id=str(current_user.id), background_tasks=background_tasks, ip_address=request.client.host)
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )
    
    return NewsResponse.model_validate(news)


@router.delete("/{news_id}")
async def delete_news_item(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    news_id: str
):
    """Delete a news item (RRHH/superadmin)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can delete news"
        )
    
    success = await delete_news(session, news_id, user_id=str(current_user.id), ip_address=request.client.host)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )
    
    return {"message": "News deleted successfully"}


@router.put("/{news_id}", response_model=NewsResponse)
@limiter.limit("10/minute")
async def update_news_item(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    background_tasks: BackgroundTasks,
    news_id: str,
    news_data: NewsUpdate
):
    """Update a news item (RRHH/superadmin)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can update news"
        )
    
    # Check if news exists (optional optimization: service checks it too, but we need 404 here if service returns None)
    # Actually, service returns None if not found, so we can rely on that.
    # But wait, original code fetched simple check. Service does logic.
    
    # Convert Pydantic model to dict, excluding None values
    update_data = news_data.model_dump(exclude_unset=True)
    
    news = await update_news(session, news_id, update_data, str(current_user.id), background_tasks=background_tasks, ip_address=request.client.host)
    
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )

    return NewsResponse.model_validate(news)


@router.get("/{news_id}", response_model=NewsResponse)
async def get_news_item(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    news_id: str
):
    """Get a single news item by ID (with security matching role)"""
    news = await get_news_by_id(session, news_id, user_role=current_user.role)
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found or access denied"
        )
    return NewsResponse.model_validate(news)
