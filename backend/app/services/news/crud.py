from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.models.news import News, NewsAttachment, NewsCarouselImage, NewsCreate
from app.models.user import User
from app.services.audit import log_action
from app.utils.file_ops import delete_file_from_disk, sync_images_from_content, delete_entity_folders
from app.utils.html_sanitizer import sanitize_html
from app.utils.email import send_news_notification


async def _notify_users_new_news(session: AsyncSession, news: News, background_tasks: BackgroundTasks):
    """Helper to notify all users with news notifications active"""
    # 1. Get all active users with notif_news = True
    result = await session.execute(
        select(User.email).where(User.is_active == True, User.notif_news == True)
    )
    user_emails = result.scalars().all()
    
    # 2. Add tasks to background_tasks
    for email in user_emails:
        background_tasks.add_task(
            send_news_notification, 
            email, 
            news.title, 
            news.summary or "", 
            str(news.id)
        )


async def create_news(
    session: AsyncSession,
    author_id: str,
    news_data: NewsCreate,
    background_tasks: BackgroundTasks | None = None,
    ip_address: str | None = None
) -> News:
    """Create a new news item"""
    author_uuid = UUID(author_id) if isinstance(author_id, str) else author_id
    
    # Set publish_date if status is publicada
    publish_date = news_data.publish_date
    is_publishing = False
    if news_data.status == 'publicada' and not publish_date:
        publish_date = datetime.utcnow()
        is_publishing = True
    
    # Sanitize HTML content to prevent XSS
    sanitized_content = sanitize_html(news_data.content)
    
    news_kwargs = {
        "author_id": author_uuid,
        "title": news_data.title,
        "summary": news_data.summary,
        "content": sanitized_content,
        "cover_image_url": news_data.cover_image_url,
        "status": news_data.status,
        "publish_date": publish_date,
    }
    if news_data.id:
        news_kwargs["id"] = news_data.id
        
    news = News(**news_kwargs)
    
    # Process attachments
    if news_data.attachments:
        for attachment in news_data.attachments:
            new_attachment = NewsAttachment(
                news_id=news.id,
                file_url=attachment['file_url'],
                file_original_name=attachment.get('file_original_name')
            )
            session.add(new_attachment)
            
    # Process carousel images
    if news_data.carousel_images:
        for i, img in enumerate(news_data.carousel_images):
            new_img = NewsCarouselImage(
                news_id=news.id,
                file_url=img['file_url'],
                order=img.get('order', i)
            )
            session.add(new_img)
            
    session.add(news)
    await session.commit()
    
    # Reload with attachments and carousel images
    result = await session.execute(
        select(News).where(News.id == news.id).options(
            selectinload(News.attachments),
            selectinload(News.carousel_images)
        )
    )
    reloaded_news = result.scalar_one()

    # If published, notify users
    if is_publishing and background_tasks:
        await _notify_users_new_news(session, reloaded_news, background_tasks)

    # Audit Log
    await log_action(
        session=session,
        user_id=author_uuid,
        action="CREATE",
        module="NOTICIAS",
        details={
            "id": str(reloaded_news.id),
            "title": reloaded_news.title,
            "status": reloaded_news.status,
            "summary": reloaded_news.summary,
            "content": reloaded_news.content,
            "cover_image_url": reloaded_news.cover_image_url,
            "has_attachments": bool(reloaded_news.attachments),
            "has_carousel": bool(reloaded_news.carousel_images)
        },
        ip_address=ip_address
    )
    
    return reloaded_news


async def update_news_status(
    session: AsyncSession,
    news_id: str,
    new_status: str,
    user_id: str,
    background_tasks: BackgroundTasks | None = None,
    ip_address: str | None = None
) -> News | None:
    """Update news status"""
    news_uuid = UUID(news_id) if isinstance(news_id, str) else news_id
    result = await session.execute(
        select(News).where(News.id == news_uuid)
    )
    news = result.scalar_one_or_none()
    
    if not news:
        return None
    
    old_status = news.status
    news.status = new_status
    
    # Set publish_date when status changes to publicada
    # If it's already publicada, we don't change the date, but if it comes from another status, we refresh it
    is_becoming_published = False
    if new_status == 'publicada' and (old_status != 'publicada' or not news.publish_date):
        news.publish_date = datetime.utcnow()
        is_becoming_published = True
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        action="UPDATE_STATUS",
        module="NOTICIAS",
        details={
            "id": str(news.id), 
            "title": news.title,
            "changes": {"status": {"old": old_status, "new": new_status}}
        },
        ip_address=ip_address
    )

    await session.commit()
    
    # Reload with attachments and carousel images
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(
            selectinload(News.attachments),
            selectinload(News.carousel_images)
        )
    )
    reloaded_news = result.scalar_one()

    # If it just became published, notify users
    if is_becoming_published and background_tasks:
        await _notify_users_new_news(session, reloaded_news, background_tasks)
    
    return reloaded_news


async def delete_news(
    session: AsyncSession,
    news_id: str,
    user_id: str,
    ip_address: str | None = None
) -> bool:
    """Delete a news item"""
    news_uuid = UUID(news_id)
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(
            selectinload(News.attachments),
            selectinload(News.carousel_images)
        )
    )
    news = result.scalar_one_or_none()
    
    if not news:
        return False
        
    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = news.model_dump()
    snapshot['id'] = str(snapshot['id'])
    snapshot['author_id'] = str(snapshot['author_id'])
    if snapshot.get('publish_date'):
        snapshot['publish_date'] = snapshot['publish_date'].isoformat()
    if snapshot.get('created_at'):
        snapshot['created_at'] = snapshot['created_at'].isoformat()
    if snapshot.get('updated_at'):
        snapshot['updated_at'] = snapshot['updated_at'].isoformat()
    
    # Capture attachments in snapshot
    snapshot['attachments'] = [
        {"file_url": att.file_url, "file_original_name": att.file_original_name} 
        for att in news.attachments
    ]
    snapshot['carousel_images'] = [
        {"file_url": img.file_url, "order": img.order} 
        for img in news.carousel_images
    ]

    # Delete the entire folder containing all media for this news item
    await delete_entity_folders("news", str(news_id))
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        action="DELETE",
        module="NOTICIAS",
        details={
            "id": news_id, 
            "title": news.title,
            "full_snapshot": snapshot
        },
        ip_address=ip_address
    )
    
    await session.delete(news)
    await session.commit()
    
    return True


async def update_news(
    session: AsyncSession,
    news_id: str,
    news_data: dict,
    current_user_id: str,
    background_tasks: BackgroundTasks | None = None,
    ip_address: str | None = None
) -> News | None:
    """Update a news item"""
    news_uuid = UUID(news_id) if isinstance(news_id, str) else news_id
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(
            selectinload(News.attachments),
            selectinload(News.carousel_images)
        )
    )
    news = result.scalar_one_or_none()
    
    if not news:
        return None
    
    # Capture old state for diffing
    old_state_dict = news.model_dump()
    
    # Update fields if provided
    if 'title' in news_data and news_data['title'] is not None:
        news.title = news_data['title']
    
    if 'summary' in news_data and news_data['summary'] is not None:
        news.summary = news_data['summary']
    
    if 'content' in news_data and news_data['content'] is not None:
        # Sanitize HTML content to prevent XSS
        sanitized_content = sanitize_html(news_data['content'])
        
        # Sync images (delete orphans)
        await sync_images_from_content(news.content, sanitized_content)
        news.content = sanitized_content

    if 'cover_image_url' in news_data:
        # Normalize: Treat empty strings as None
        new_cover_url = news_data['cover_image_url']
        if new_cover_url == '':
            new_cover_url = None
            
        # Delete old cover image if it changed
        if news.cover_image_url and news.cover_image_url != new_cover_url:
            await delete_file_from_disk(news.cover_image_url)
        news.cover_image_url = new_cover_url
    
    is_becoming_published = False
    if 'status' in news_data and news_data['status'] is not None:
        old_status = news.status
        news.status = news_data['status']
        # Set publish_date when status changes to publicada from another status
        if news_data['status'] == 'publicada' and (old_status != 'publicada' or not news.publish_date):
            news.publish_date = datetime.utcnow()
            is_becoming_published = True
    
    if 'publish_date' in news_data:
        news.publish_date = news_data['publish_date']
        
    # Attachments handling
    attachments_updated = False
    if 'attachments' in news_data and news_data['attachments'] is not None:
        current_attachments = news.attachments
        current_urls = {att.file_url for att in current_attachments}
        
        new_attachments_data = news_data['attachments']
        new_urls = {att['file_url'] for att in new_attachments_data}
        
        # 1. Identify removed
        for att in current_attachments:
            if att.file_url not in new_urls:
                await session.delete(att)
                await delete_file_from_disk(att.file_url)
                attachments_updated = True
        
        # 2. Add new
        for att_data in new_attachments_data:
            if att_data['file_url'] not in current_urls:
                new_att = NewsAttachment(
                    news_id=news.id,
                    file_url=att_data['file_url'],
                    file_original_name=att_data.get('file_original_name')
                )
                session.add(new_att)
                attachments_updated = True
    
    # Carousel images handling
    carousel_updated = False
    if 'carousel_images' in news_data and news_data['carousel_images'] is not None:
        current_carousel = news.carousel_images
        current_urls = {img.file_url for img in current_carousel}
        
        new_carousel_data = news_data['carousel_images']
        new_urls = {img['file_url'] for img in new_carousel_data}
        
        # 1. Identify removed
        for img in current_carousel:
            if img.file_url not in new_urls:
                await session.delete(img)
                await delete_file_from_disk(img.file_url)
                carousel_updated = True
        
        # 2. Add or Update
        for i, img_data in enumerate(new_carousel_data):
            if img_data['file_url'] not in current_urls:
                new_img = NewsCarouselImage(
                    news_id=news.id,
                    file_url=img_data['file_url'],
                    order=img_data.get('order', i)
                )
                session.add(new_img)
                carousel_updated = True
            else:
                # Update order if it changed
                # Finding the existing one
                existing = next((img for img in current_carousel if img.file_url == img_data['file_url']), None)
                if existing and existing.order != img_data.get('order', i):
                    existing.order = img_data.get('order', i)
                    carousel_updated = True
    
    # Audit Log
    from app.services.audit import generate_diff, log_action
    
    # Prepare new state dict for diff utility
    new_state_dict = news.model_dump()
    diffs = generate_diff(old_state_dict, new_state_dict)
    
    if attachments_updated:
        diffs['attachments'] = {"old": "...", "new": "Updated"}
    
    if carousel_updated:
        diffs['carousel_images'] = {"old": "...", "new": "Updated"}
    
    if diffs:
        await log_action(
            session=session,
            user_id=UUID(current_user_id) if isinstance(current_user_id, str) else current_user_id,
            action="UPDATE",
            module="NOTICIAS",
            details={
                "id": str(news.id),
                "title": news.title,
                "changes": diffs
            },
            ip_address=ip_address
        )
    
    await session.commit()
    
    # Reload with attachments and carousel images
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(
            selectinload(News.attachments),
            selectinload(News.carousel_images)
        )
    )
    reloaded_news = result.scalar_one()

    # If it just became published, notify users
    if is_becoming_published and background_tasks:
        await _notify_users_new_news(session, reloaded_news, background_tasks)
    
    return reloaded_news
