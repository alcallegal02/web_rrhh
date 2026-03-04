from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["config"])

@router.get("/upload-limits")
async def get_upload_limits():
    """Get upload size limits configuration"""
    return {
        "maxImageSizeMB": settings.MAX_IMAGE_SIZE_MB,
        "maxDocumentSizeMB": settings.MAX_DOCUMENT_SIZE_MB,
        "maxComplaintPayloadMB": settings.MAX_COMPLAINT_PAYLOAD_MB,
        "maxNewsPayloadMB": settings.MAX_NEWS_PAYLOAD_MB,
        "dailyUploadQuotaMB": settings.DAILY_UPLOAD_QUOTA_MB,
        "bruteForceRedirectUrl": settings.BRUTE_FORCE_REDIRECT_URL,
        "bruteForceMaxAttempts": settings.BRUTE_FORCE_MAX_ATTEMPTS
    }
