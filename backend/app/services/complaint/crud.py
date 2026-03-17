import re
import secrets
import string
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, text

from app.models.complaint import (
    Complaint,
    ComplaintAttachment,
    ComplaintComment,
    ComplaintCreate,
    ComplaintStatusLog,
)
from app.services.audit import log_action
from app.utils.file_ops import delete_file_from_disk, sync_images_from_content
from app.utils.html_sanitizer import sanitize_html


async def process_and_save_complaint_files(
    files: list[object], # List[UploadFile] really, but typing generic object to avoid dep cycle if needed, though we can import UploadFile under IF TYPE_CHECKING
    session: AsyncSession,
    client_ip: str,
    entity_id: str | None = None
) -> list[dict]:
    """
    Process, validate, convert (images) and save files for a complaint.
    Returns list of attachment dicts {file_url, file_original_name}.
    WARNING: Expects FastAPI UploadFile objects.
    """
    import logging
    from pathlib import Path

    from app.config import settings
    from app.utils.file_processing import save_file_organized
    from app.utils.image_processing import process_image_to_webp
    from app.utils.security import (
        sanitize_filename,
        validate_file_extension,
        validate_magic_numbers,
    )
    from app.utils.upload_security import check_upload_quota, validate_payload_size
    
    logger = logging.getLogger(__name__)

    if not files:
        return []

    # 1. Validate total payload size
    file_contents = []
    for file in files:
        content = await file.read()
        file_contents.append(content)
        await file.seek(0) 
    
    total_size = validate_payload_size(file_contents, settings.MAX_COMPLAINT_PAYLOAD)
    
    # 2. Check daily quota for IP
    await check_upload_quota(session, client_ip, total_size)
    
    # 3. Process and Save
    attachments = []
    
    for i, file in enumerate(files):
        # Sanitize and validate each file
        original_filename = sanitize_filename(file.filename)
        validate_file_extension(original_filename, {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'})
        
        content = file_contents[i]
        # Validate magic bytes
        validate_magic_numbers(content, original_filename)

        ext = original_filename.split('.')[-1].lower() if '.' in original_filename else ''
        
        # If it's an image, convert to WebP
        is_image = ext in ['jpg', 'jpeg', 'png', 'webp']
        if is_image:
            try:
                content, new_ext = process_image_to_webp(content, quality=80)
                ext = new_ext
            except Exception as e:
                logger.warning(f"Failed to convert {original_filename} to WebP: {e}")
        
        result = await save_file_organized(
            content=content,
            filename=original_filename if not is_image else f"{Path(original_filename).stem}.webp",
            module="complaints",
            file_type="images" if is_image else "documents",
            entity_id=entity_id
        )
        
        attachments.append({
            "file_url": result["url"],
            "file_original_name": original_filename if not is_image else f"{Path(original_filename).stem}.webp"
        })
        
    return attachments


async def create_complaint(
    session: AsyncSession,
    complaint_data: ComplaintCreate
) -> Complaint:
    """Create a new anonymous complaint"""
    # Generate a long tracking code (16 chars, uppercase alphanumeric)
    chars = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(chars) for _ in range(16))
    # Format: XXXX-XXXX-XXXX-XXXX
    code = f"{code[:4]}-{code[4:8]}-{code[8:12]}-{code[12:]}"

    # Generate a strong access token (Clave de Seguridad) - 12 chars alphanumeric
    access_token = ''.join(secrets.choice(chars) for _ in range(12))
    
    # Sanitize HTML description
    sanitized_description = sanitize_html(complaint_data.description)
    
    complaint_data_dict = complaint_data.model_dump()
    complaint_data_dict['description'] = sanitized_description
    attachments_data = complaint_data_dict.pop('attachments', [])
    
    complaint = Complaint(
        code=code,
        access_token=access_token,
        **complaint_data_dict
    )
    session.add(complaint)
    await session.flush()  # Get complaint ID
    
    # Handle multiple attachments
    if attachments_data:
        for att in attachments_data:
            attachment = ComplaintAttachment(
                complaint_id=complaint.id,
                file_url=att['file_url'],
                file_original_name=att.get('file_original_name')
            )
            session.add(attachment)
    await session.commit()
    
    # Reload with all relationships to avoid Pydantic evaluation errors
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(Complaint)
        .where(Complaint.id == complaint.id)
        .options(
            selectinload(Complaint.attachments),
            selectinload(Complaint.comments).selectinload(ComplaintComment.attachments)
        )
    )
    complaint = result.scalar_one()
    
    # EXPLICITLY NOT LOGGING CREATION FOR ANONYMITY
    
    return complaint


async def create_complaint_comment(
    session: AsyncSession,
    complaint_id: UUID,
    content: str,
    is_public: bool,
    user_id: UUID | None = None,
    attachments: list[dict] | None = None
) -> ComplaintComment | None:
    """Create a new comment on a complaint"""
    result = await session.execute(
        select(Complaint).where(Complaint.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()
    
    if not complaint:
        return None
        
    # Sanitize content
    sanitized_content = sanitize_html(content)
    
    # Snapshot current status
    comment = ComplaintComment(
        complaint_id=complaint_id,
        user_id=user_id,
        content=sanitized_content,
        is_public=is_public,
        complaint_status=complaint.status
    )
    
    session.add(comment)
    await session.flush()  # Get comment ID
    
    # Handle attachments
    if attachments:
        for att in attachments:
            attachment = CommentAttachment(
                comment_id=comment.id,
                file_url=att['file_url'],
                file_original_name=att.get('file_original_name')
            )
            session.add(attachment)
            
    await session.commit()
    
    # Reload with attachments
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(ComplaintComment)
        .where(ComplaintComment.id == comment.id)
        .options(selectinload(ComplaintComment.attachments))
    )
    comment = result.scalar_one()
    
    return comment


async def update_complaint_status(
    session: AsyncSession,
    complaint_id: UUID,
    new_status: str,
    admin_id: UUID,
    admin_notes: str | None = None,
    status_public_description: str | None = None,
    ip_address: str | None = None
) -> Complaint | None:
    """Update complaint status and record in log"""
    result = await session.execute(
        select(Complaint).where(Complaint.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()
    
    if not complaint:
        return None
    
    old_status = complaint.status
    old_admin_response = complaint.admin_response
    
    complaint.status = new_status
    if status_public_description is not None:
        complaint.status_public_description = status_public_description
    if admin_notes is not None:
        # Sync images in admin response (delete orphans)
        await sync_images_from_content(complaint.admin_response, admin_notes)
        complaint.admin_response = admin_notes
    
    complaint.updated_at = datetime.utcnow()
    
    # Record in log (DB ComplaintStatusLog - Application Logic)
    status_log = ComplaintStatusLog(
        complaint_id=complaint.id,
        old_status=old_status,
        new_status=new_status,
        admin_notes=admin_notes,
        changed_by_id=admin_id
    )
    session.add(status_log)
    
    # Audit Log (Global Audit - Security/Compliance Logic)
    from app.services.audit import generate_diff, log_action
    
    diffs = {
        "status": {"old": old_status, "new": new_status}
    }
    if admin_notes is not None and admin_notes != old_admin_response:
        diffs["admin_response"] = {"old": "...", "new": "Updated"}

    await log_action(
        session=session,
        user_id=admin_id,
        action="UPDATE_STATUS",
        module="DENUNCIAS",
        details={
            "complaint_id": str(complaint.id),
            "complaint_code": complaint.code,
            "changes": diffs
        },
        ip_address=ip_address
    )
    
    await session.commit()
    
    # Reload with all relationships to avoid Lazy Loading errors in response
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(Complaint)
        .where(Complaint.id == complaint.id)
        .options(
            selectinload(Complaint.attachments),
            selectinload(Complaint.comments).selectinload(ComplaintComment.attachments)
        )
    )
    complaint = result.scalar_one()
    
    return complaint


async def delete_complaint(
    session: AsyncSession,
    complaint_id: UUID,
    user_id: UUID,
    ip_address: str | None = None
) -> bool:
    """Delete a complaint and all its associated files"""
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(Complaint)
        .where(Complaint.id == complaint_id)
        .options(selectinload(Complaint.attachments))
    )
    complaint = result.scalar_one_or_none()
    
    if not complaint:
        return False
        
    # Capture Full Snapshot for Audit BEFORE deletion
    snapshot = complaint.model_dump()
    snapshot['id'] = str(snapshot['id'])
    if snapshot.get('created_at'):
        snapshot['created_at'] = snapshot['created_at'].isoformat()
    if snapshot.get('updated_at'):
        snapshot['updated_at'] = snapshot['updated_at'].isoformat()
    
    # Capture attachments
    snapshot['attachments'] = [
        {"file_url": att.file_url, "file_original_name": att.file_original_name} 
        for att in complaint.attachments
    ]

    # Delete the entire folder containing all media for this complaint
    from app.utils.file_ops import delete_entity_folders
    await delete_entity_folders("complaints", str(complaint_id))
    
    # 3. Delete status logs (manual deletion since we don't have cascade on DB)
    await session.execute(
        text(f"DELETE FROM complaint_status_logs WHERE complaint_id = '{complaint_id}'")
    )
    
    # Audit Log
    from app.services.audit import log_action
    await log_action(
        session=session,
        user_id=user_id,
        action="DELETE",
        module="DENUNCIAS",
        details={
            "complaint_id": str(complaint_id), 
            "complaint_code": complaint.code,
            "full_snapshot": snapshot
        },
        ip_address=ip_address
    )

    # 4. Delete the complaint record
    await session.delete(complaint)
    await session.commit()
    
    return True
