from typing import Optional, List
from datetime import datetime
from uuid import UUID
import string
import secrets
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, text
from sqlalchemy.orm import selectinload

from app.models.complaint import Complaint, ComplaintCreate, ComplaintStatusLog, ComplaintStatus, ComplaintAttachment
from app.utils.html_sanitizer import sanitize_html
from app.utils.file_ops import delete_file_from_disk, sync_images_from_content
from app.services.audit import log_action

async def process_and_save_complaint_files(
    files: List[object], # List[UploadFile] really, but typing generic object to avoid dep cycle if needed, though we can import UploadFile under IF TYPE_CHECKING
    session: AsyncSession,
    client_ip: str
) -> List[dict]:
    """
    Process, validate, convert (images) and save files for a complaint.
    Returns list of attachment dicts {file_url, file_original_name}.
    WARNING: Expects FastAPI UploadFile objects.
    """
    from app.utils.upload_security import validate_payload_size, check_upload_quota
    from app.config import settings
    from app.utils.security import validate_file_extension, sanitize_filename, validate_magic_numbers
    from app.utils.image_processing import process_image_to_webp
    from app.utils.file_processing import save_file_organized
    from pathlib import Path
    import logging
    
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
            file_type="images" if is_image else "documents"
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
    
    # Reload with attachments
    result = await session.execute(
        select(Complaint).where(Complaint.id == complaint.id) # .options(selectinload(Complaint.attachments))
    )
    complaint = result.scalar_one()
    
    # EXPLICITLY NOT LOGGING CREATION FOR ANONYMITY
    
    return complaint


async def update_complaint_status(
    session: AsyncSession,
    complaint_id: UUID,
    new_status: str,
    admin_id: UUID,
    admin_notes: Optional[str] = None,
    status_public_description: Optional[str] = None,
    ip_address: Optional[str] = None
) -> Optional[Complaint]:
    """Update complaint status and record in log"""
    result = await session.execute(
        select(Complaint).where(Complaint.id == complaint_id)
    )
    complaint = result.scalar_one_or_none()
    
    if not complaint:
        return None
    
    old_status = complaint.status
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
    
    await session.commit()
    await session.refresh(complaint)
    
    # Audit Log (Global Audit - Security/Compliance Logic)
    await log_action(
        session=session,
        user_id=admin_id,
        action="UPDATE_STATUS",
        module="DENUNCIAS",
        details={
            "complaint_id": str(complaint.id),
            "old_status": old_status,
            "new_status": new_status,
            "admin_notes": admin_notes
        },
        ip_address=ip_address
    )
    
    return complaint


async def delete_complaint(
    session: AsyncSession,
    complaint_id: UUID,
    user_id: UUID,
    ip_address: Optional[str] = None
) -> bool:
    """Delete a complaint and all its associated files"""
    result = await session.execute(
        select(Complaint)
        .where(Complaint.id == complaint_id)
        # .options(selectinload(Complaint.attachments))
    )
    complaint = result.scalar_one_or_none()
    
    if not complaint:
        return False
        
    complaint_title = complaint.title # Capture for log
    
    # 1. Delete main attachment if exists (deprecated but kept for compatibility)
    if complaint.file_path:
        await delete_file_from_disk(complaint.file_path)
    
    # 2. Delete new multi-attachments
    for attachment in complaint.attachments:
        await delete_file_from_disk(attachment.file_url)
    
    # 3. Delete images embedded in description
    if complaint.description:
        # Regex to find all /uploads/images/ URLs
        # Updated regex to match original file logic
        img_regex = r'src="(/uploads/images/[^"]+)"'
        images = re.findall(img_regex, complaint.description)
        for img_url in images:
            await delete_file_from_disk(img_url)
    
    # 3. Delete status logs (manual deletion since we don't have cascade on DB)
    await session.execute(
        text(f"DELETE FROM complaint_status_logs WHERE complaint_id = '{complaint_id}'")
    )
    
    # 4. Delete the complaint record
    await session.delete(complaint)
    await session.commit()
    
    # Audit Log
    await log_action(
        session=session,
        user_id=user_id,
        action="DELETE",
        module="DENUNCIAS",
        details={"complaint_id": str(complaint_id), "title": complaint_title},
        ip_address=ip_address
    )
    
    return True
