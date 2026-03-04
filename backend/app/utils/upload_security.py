import logging
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import text

from app.config import settings

logger = logging.getLogger(__name__)

async def check_upload_quota(session: AsyncSession, ip_address: str, new_bytes: int):
    """
    Check if the IP has exceeded its daily upload quota.
    Updates the quota if within limits.
    """
    today = date.today()
    
    # Check current quota
    result = await session.execute(
        text("SELECT total_bytes FROM upload_quotas WHERE ip_address = :ip AND date = :today"),
        {"ip": ip_address, "today": today}
    )
    current_bytes = result.scalar() or 0
    
    if current_bytes + new_bytes > settings.DAILY_UPLOAD_QUOTA:
        logger.warning(f"IP {ip_address} exceeded daily upload quota. Attempted: {new_bytes}, Current: {current_bytes}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Has superado tu cuota diaria de subida ({settings.DAILY_UPLOAD_QUOTA_MB}MB). "
                   f"Por favor, inténtalo de nuevo mañana."
        )
    
    # Update quota (idempotent upsert)
    await session.execute(
        text("""
            INSERT INTO upload_quotas (ip_address, date, total_bytes)
            VALUES (:ip, :today, :new_bytes)
            ON CONFLICT (ip_address, date)
            DO UPDATE SET total_bytes = upload_quotas.total_bytes + :new_bytes
        """),
        {"ip": ip_address, "today": today, "new_bytes": new_bytes}
    )
    await session.commit()

def validate_payload_size(files_content: list[bytes], max_size: int):
    """Validate the total size of multiple files"""
    total_size = sum(len(c) for c in files_content)
    if total_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El tamaño total de los archivos ({total_size // (1024*1024)}MB) "
                   f"excede el límite permitido ({max_size // (1024*1024)}MB)."
        )
    return total_size
