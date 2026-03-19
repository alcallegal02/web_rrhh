import os

import httpx
from fastapi import HTTPException, UploadFile, status

from app.config import settings

# from app.utils.image_processing import process_image_to_webp # No longer needed locally
from app.services.audit import log_action
from app.utils.security import (
    validate_file_extension,
    validate_magic_numbers,
)
from app.utils.upload_security import check_upload_quota


class UploadService:
    @staticmethod
    async def send_to_media_service(file: UploadFile, module: str, upload_type: str, entity_id: str | None = None) -> dict:
        """Proxy execution to the isolated Media Fortress"""
        media_service_url = os.getenv("MEDIA_SERVICE_URL", "http://media:8000")
        url = f"{media_service_url}/upload/file"
        
        try:
            # rewind file to be sure
            await file.seek(0)
            content = await file.read()
            
            async with httpx.AsyncClient() as client:
                files = {'file': (file.filename, content, file.content_type)}
                data = {'module': module, 'type': upload_type}
                if entity_id:
                    data['entity_id'] = entity_id
                    
                response = await client.post(url, files=files, data=data)
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail=f"Media Service Error: {response.text}"
                    )
                return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Media Fortress Unreachable: {str(e)}")
        except Exception as e:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Media Proxy Error: {str(e)}")

    @staticmethod
    async def validate_document(file: UploadFile) -> tuple[bytes, str]:
        """Validate document file (Pre-flight check)"""
        allowed = [
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'application/rtf'
        ]
        
        if file.content_type not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed: PDF, DOC, DOCX, TXT, RTF"
            )

        # Basic pre-flight validation to save bandwidth
        content = await file.read()
        validate_file_extension(file.filename)
        validate_magic_numbers(content, file.filename)

        if len(content) > settings.MAX_DOCUMENT_SIZE:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Max: {settings.MAX_DOCUMENT_SIZE_MB}MB"
            )
        
        return content, "dat" # Extension handled by media service

    @classmethod
    async def process_upload(
        cls, 
        session, 
        user_id, 
        ip_address, 
        file: UploadFile, 
        module: str, 
        upload_type: str, 
        entity_id: str | None = None,
        anonymous: bool = False
    ):
        """Generic upload processing pipeline"""
        import logging
        import traceback
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"Processing upload: file={file.filename}, module={module}, type={upload_type}, entity_id={entity_id}")
            
            # 1. Pre-flight Validation & Quota Check
            file.file.seek(0, 2)
            size = file.file.tell()
            file.file.seek(0)
            
            if upload_type == "document":
                 await cls.validate_document(file)
            
            if ip_address:
                await check_upload_quota(session, ip_address, size)

            # 2. Delegate to Media Fortress
            logger.info(f"Delegating {upload_type} to Media Fortress...")
            result = await cls.send_to_media_service(file, module, upload_type, entity_id)
            
            # 3. Audit Logic
            action = "UPLOAD_FILE_ANONYMOUS" if anonymous else "UPLOAD_FILE"
            await log_action(
                session,
                user_id=user_id,
                action=action,
                module=f"UPLOAD_{module.upper()}",
                details={
                    "filename": result['filename'],
                    "type": upload_type,
                    "service": "media-fortress",
                    "hash": result.get('hash'),
                    "path": result['path'],
                    "entity_id": entity_id
                },
                ip_address=ip_address
            )
            
            return {
                "url": result['path'],
                "filename": result['filename'],
                "original_filename": result['original_filename'],
                "deduplicated": True,
                "compressed": result.get('content_type') == 'image/webp' # Metadata from service
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"CRITICAL ERROR in process_upload: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en el servidor de subidas: {str(e)}"
            )
