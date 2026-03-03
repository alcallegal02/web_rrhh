from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
from typing import Optional

from app.database import get_session
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.config import settings
from app.services.upload import UploadService
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(tags=["upload"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/image")
@limiter.limit("5/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    module: str = "common",
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upload an image file (RRHH/superadmin only)"""
    if current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can upload images"
        )
    
    return await UploadService.process_upload(
        session=session,
        user_id=current_user.id,
        ip_address=request.client.host,
        file=file,
        module=module,
        upload_type="image",
        anonymous=False
    )

@router.post("/image-anonymous")
@limiter.limit("5/minute")
async def upload_image_anonymous(
    request: Request,
    file: UploadFile = File(...),
    module: str = "complaints",
    session: AsyncSession = Depends(get_session)
):
    """Upload an image file anonymously (for complaints)"""
    return await UploadService.process_upload(
        session=session,
        user_id=None,
        ip_address=request.client.host,
        file=file,
        module=module,
        upload_type="image",
        anonymous=True
    )

@router.post("/document")
@limiter.limit("5/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    module: str = "common",
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upload a document file"""
    # Permission Logic
    if module != "vacations" and current_user.role_enum not in [UserRole.RRHH, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RRHH/superadmin can upload documents to this module"
        )
    
    return await UploadService.process_upload(
        session=session,
        user_id=current_user.id,
        ip_address=request.client.host,
        file=file,
        module=module,
        upload_type="document",
        anonymous=False
    )

@router.get("/download")
async def download_file(
    file_path: str,
    original_name: Optional[str] = None
):
    """
    Proxy download endpoint to serve files.
    file_path should be the relative path stored in DB (e.g., /uploads/complaints/documents/hash.pdf.gz)
    """
    clean_path = file_path.lstrip('/')
    base_uploads = Path(settings.UPLOAD_DIR).resolve()
    disk_path = (base_uploads.parent / clean_path).resolve()
    
    # Path Traversal Check
    if not str(disk_path).startswith(str(base_uploads)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not disk_path.exists() or not disk_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    filename_to_use = original_name if original_name else disk_path.name
    if filename_to_use.endswith('.gz'):
        filename_to_use = filename_to_use[:-3]
    
    headers = {}
    if disk_path.suffix == '.gz':
        headers["Content-Encoding"] = "gzip"

    return FileResponse(
        path=disk_path,
        filename=filename_to_use,
        media_type='application/octet-stream',
        headers=headers
    )
