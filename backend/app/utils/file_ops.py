import os
import httpx
import logging
import re
from app.config import settings

logger = logging.getLogger(__name__)


async def delete_file_from_disk(file_url: str) -> bool:
    """
    Delete a file from disk via the Media Service API.
    Example URL: /media/news/images/uuid/hash.webp
    """
    try:
        if not file_url:
            return False
            
        media_service_url = os.getenv("MEDIA_SERVICE_URL", "http://media:8000")
        url = f"{media_service_url}/delete/file"
        
        logger.info(f"Calling Media Service to delete file: {file_url}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(url, params={"path": file_url})
            
            if response.status_code == 200:
                result = response.json()
                if result.get("status") == "deleted":
                    logger.info(f"Media Service successfully deleted file: {file_url}")
                    return True
                elif result.get("status") == "not_found":
                    logger.warning(f"Media Service could not find file for deletion: {file_url}")
                    return False
            
            logger.error(f"Media Service deletion failed for {file_url}: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error calling Media Service for deletion of {file_url}: {e}")
        return False


async def delete_entity_folders(module: str, entity_id: str) -> bool:
    """
    Delete all media folders related to a specific entity ID via the Media Service API.
    """
    try:
        if not module or not entity_id:
            return False

        media_service_url = os.getenv("MEDIA_SERVICE_URL", "http://media:8000")
        url = f"{media_service_url}/delete/folder"
        
        logger.info(f"Calling Media Service to delete folders for: {module}/{entity_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, params={"module": module, "entity_id": entity_id})
            
            if response.status_code == 200:
                logger.info(f"Media Service successfully deleted folders for: {module}/{entity_id}")
                return True
                
            logger.error(f"Media Service folder deletion failed for {module}/{entity_id}: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error calling Media Service for folder deletion: {e}")
        return False


async def sync_images_from_content(old_content: str, new_content: str):
    """
    Compare old and new content, identify images that were removed,
    and delete them from disk.
    Expects URLs starting with /media/ or /uploads/
    """
    if not old_content:
        return

    # Helper function to find all media URLs
    def find_uploads(content: str) -> set[str]:
        if not content:
            return set()
        # Find all src="/media/..." or src="/uploads/..."
        return set(re.findall(r'src="(/(?:media|uploads)/[^"]+)"', content))

    old_images = find_uploads(old_content)
    new_images = find_uploads(new_content)

    removed_images = old_images - new_images

    for img_url in removed_images:
        await delete_file_from_disk(img_url)
