from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.models.news import News, NewsCreate, NewsUpdate, NewsResponse
from app.services.news import create_news, update_news_status, get_all_published_news, get_all_news, update_news, get_news_by_id, delete_news, get_latest_published_news


router = APIRouter(tags=["news"])
limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=NewsResponse)
@limiter.limit("5/minute")
async def create_news_item(
    request: Request,
    news_data: NewsCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Create a new news item (RRHH/admin/superadmin)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can create news"
        )
    
    news = await create_news(session, str(current_user.id), news_data, ip_address=request.client.host)
    return NewsResponse.model_validate(news)


@router.get("", response_model=List[NewsResponse])
async def get_news(
    status: Optional[str] = Query(None, description="Filter by status: borrador, publicada, archivada"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get news - with automatic status filtering based on role"""
    news_list = await get_all_news(
        session, 
        user_role=current_user.role, 
        status=status,
        limit=limit, 
        offset=offset
    )
    
    return [NewsResponse.model_validate(news) for news in news_list]


@router.get("/latest", response_model=Optional[NewsResponse])
async def get_latest_news_item(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
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
    news_id: str,
    new_status: str = Query(..., description="New status: borrador, publicada, archivada"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
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
    
    news = await update_news_status(session, news_id, new_status, user_id=str(current_user.id), ip_address=request.client.host)
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )
    
    return NewsResponse.model_validate(news)


@router.delete("/{news_id}")
async def delete_news_item(
    news_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
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
    news_id: str,
    news_data: NewsUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
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
    
    news = await update_news(session, news_id, update_data, str(current_user.id), ip_address=request.client.host)
    
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found"
        )

    return NewsResponse.model_validate(news)


@router.get("/{news_id}", response_model=NewsResponse)
async def get_news_item(
    news_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get a single news item by ID (with security matching role)"""
    news = await get_news_by_id(session, news_id, user_role=current_user.role)
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found or access denied"
        )
    return NewsResponse.model_validate(news)
