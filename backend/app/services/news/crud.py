from typing import Optional, Any
from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.models.news import News, NewsCreate, NewsAttachment
from app.utils.html_sanitizer import sanitize_html
from app.utils.file_ops import delete_file_from_disk, sync_images_from_content
from app.services.audit import log_action

async def create_news(
    session: AsyncSession,
    author_id: str,
    news_data: NewsCreate,
    ip_address: Optional[str] = None
) -> News:
    """Create a new news item"""
    author_uuid = UUID(author_id) if isinstance(author_id, str) else author_id
    
    # Set publish_date if status is publicada
    publish_date = news_data.publish_date
    if news_data.status == 'publicada' and not publish_date:
        publish_date = datetime.utcnow()
    
    # Sanitize HTML content to prevent XSS
    sanitized_content = sanitize_html(news_data.content)
    
    news = News(
        author_id=author_uuid,
        title=news_data.title,
        summary=news_data.summary,
        content=sanitized_content,
        cover_image_url=news_data.cover_image_url,
        status=news_data.status,
        publish_date=publish_date,
    )
    
    # Process attachments
    if news_data.attachments:
        for attachment in news_data.attachments:
            new_attachment = NewsAttachment(
                news_id=news.id,
                file_url=attachment['file_url'],
                file_original_name=attachment.get('file_original_name')
            )
            session.add(new_attachment)
            
    session.add(news)
    await session.commit()
    
    # Reload with attachments
    result = await session.execute(
        select(News).where(News.id == news.id).options(selectinload(News.attachments))
    )
    reloaded_news = result.scalar_one()

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
            "has_attachments": bool(reloaded_news.attachments)
        },
        ip_address=ip_address
    )
    
    return reloaded_news


async def update_news_status(
    session: AsyncSession,
    news_id: str,
    new_status: str,
    user_id: str,
    ip_address: Optional[str] = None
) -> Optional[News]:
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
    if new_status == 'publicada' and (old_status != 'publicada' or not news.publish_date):
        news.publish_date = datetime.utcnow()
    
    await session.commit()
    
    # Reload with attachments
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(selectinload(News.attachments))
    )
    
    # Audit Log
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

    return result.scalar_one()


async def delete_news(
    session: AsyncSession,
    news_id: str,
    user_id: str,
    ip_address: Optional[str] = None
) -> bool:
    """Delete a news item"""
    news_uuid = UUID(news_id)
    result = await session.execute(
        select(News).where(News.id == news_uuid)
    )
    news = result.scalar_one_or_none()
    
    if not news:
        return False
        
    news_title = news.title # Capture for log

    # Delete associated files from disk BEFORE deleting record
    # 1. Attachments
    result_attachments = await session.execute(
        select(NewsAttachment).where(NewsAttachment.news_id == news_uuid)
    )
    attachments = result_attachments.scalars().all()
    for att in attachments:
        await delete_file_from_disk(att.file_url)
        
    # 2. Embedded images in content
    if news.content:
        import re
        images = re.findall(r'src="(/uploads/[^"]+)"', news.content)
        for img_url in images:
            await delete_file_from_disk(img_url)
            
    # 3. Cover image
    if news.cover_image_url:
        await delete_file_from_disk(news.cover_image_url)
    
    await session.delete(news)
    await session.commit()
    
    # Audit Log
    await log_action(
        session=session,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        action="DELETE",
        module="NOTICIAS",
        details={"id": news_id, "title": news_title},
        ip_address=ip_address
    )
    
    return True


async def update_news(
    session: AsyncSession,
    news_id: str,
    news_data: dict,
    current_user_id: str,
    ip_address: Optional[str] = None
) -> Optional[News]:
    """Update a news item"""
    news_uuid = UUID(news_id) if isinstance(news_id, str) else news_id
    result = await session.execute(
        select(News).where(News.id == news_uuid)
    )
    news = result.scalar_one_or_none()
    
    if not news:
        return None
    
    # Diff Logic
    diffs = {}
    def check_diff(field: str, new_val: Any, old_val: Any):
        if new_val is not None:
            # s_new = str(new_val) if isinstance(new_val, (UUID, datetime, date)) else new_val
            # s_old = str(old_val) if isinstance(old_val, (UUID, datetime, date)) else old_val
            # Simplified diff for now
            if new_val != old_val:
                 diffs[field] = {"old": str(old_val), "new": str(new_val)}

    # Update fields if provided
    if 'title' in news_data and news_data['title'] is not None:
        check_diff('title', news_data['title'], news.title)
        news.title = news_data['title']
    
    if 'summary' in news_data and news_data['summary'] is not None:
        check_diff('summary', news_data['summary'], news.summary)
        news.summary = news_data['summary']
    
    if 'content' in news_data and news_data['content'] is not None:
        # Sanitize HTML content to prevent XSS
        sanitized_content = sanitize_html(news_data['content'])
        
        # Sync images (delete orphans)
        await sync_images_from_content(news.content, sanitized_content)
        
        check_diff('content', 'updated', 'old_content') # Don't log full content
        news.content = sanitized_content

    if 'cover_image_url' in news_data:
        # Delete old cover image if it changed
        if news.cover_image_url and news.cover_image_url != news_data['cover_image_url']:
            await delete_file_from_disk(news.cover_image_url)
        check_diff('cover_image_url', news_data['cover_image_url'], news.cover_image_url)
        news.cover_image_url = news_data['cover_image_url']
    
    if 'status' in news_data and news_data['status'] is not None:
        old_status = news.status
        check_diff('status', news_data['status'], old_status)
        news.status = news_data['status']
        # Set publish_date when status changes to publicada from another status
        if news_data['status'] == 'publicada' and (old_status != 'publicada' or not news.publish_date):
            news.publish_date = datetime.utcnow()
    
    if 'publish_date' in news_data:
        check_diff('publish_date', news_data['publish_date'], news.publish_date)
        news.publish_date = news_data['publish_date']
        
    # Attachments handling
    if 'attachments' in news_data and news_data['attachments'] is not None:
        # Get current attachments
        result_attachments = await session.execute(
            select(NewsAttachment).where(NewsAttachment.news_id == news_uuid)
        )
        current_attachments = result_attachments.scalars().all()
        current_urls = {att.file_url for att in current_attachments}
        
        new_attachments_data = news_data['attachments']
        new_urls = {att['file_url'] for att in new_attachments_data}
        
        attachments_changed = False
        
        # 1. Identify removed
        for att in current_attachments:
            if att.file_url not in new_urls:
                await session.delete(att)
                await delete_file_from_disk(att.file_url)
                attachments_changed = True
        
        # 2. Add new
        for att_data in new_attachments_data:
            if att_data['file_url'] not in current_urls:
                new_att = NewsAttachment(
                    news_id=news.id,
                    file_url=att_data['file_url'],
                    file_original_name=att_data.get('file_original_name')
                )
                session.add(new_att)
                attachments_changed = True
        
        if attachments_changed:
            diffs['attachments'] = {"old": "...", "new": "Updated"}
    
    await session.commit()
    
    # Reload with attachments
    result = await session.execute(
        select(News).where(News.id == news_uuid).options(selectinload(News.attachments))
    )
    
    # Audit Log
    if diffs:
        await log_action(
            session=session,
            user_id=UUID(current_user_id) if isinstance(current_user_id, str) else current_user_id,
            action="UPDATE",
            module="NOTICIAS",
            details={
                "id": str(news.id),
                "changes": diffs
            },
            ip_address=ip_address
        )
    
    return result.scalar_one()
