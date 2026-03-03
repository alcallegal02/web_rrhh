import os
import re
import logging
from pathlib import Path
from typing import Set
from app.config import settings

logger = logging.getLogger(__name__)


import aiofiles.os

async def delete_file_from_disk(file_url: str) -> bool:
    """
    Delete a file from disk given its URL path.
    Example URL: /uploads/documents/uuid.pdf
    """
    try:
        if not file_url:
            return False
            
        # Remove leading slash if present
        if file_url.startswith('/'):
            file_url = file_url[1:]
            
        relative_path = file_url.replace('uploads/', '', 1) 
        file_path = Path(settings.UPLOAD_DIR) / relative_path
        
        # Use aiofiles.os for async file operations
        if await aiofiles.os.path.exists(file_path) and await aiofiles.os.path.isfile(file_path):
            await aiofiles.os.remove(file_path)
            logger.info(f"Deleted file: {file_path}")
            return True
        else:
            logger.warning(f"File not found for deletion: {file_path}")
            return False
            
    except Exception as e:
        logger.error(f"Error deleting file {file_url}: {e}")
        return False


async def sync_images_from_content(old_content: str, new_content: str):
    """
    Compare old and new content, identify images that were removed,
    and delete them from disk.
    Expects URLs starting with /uploads/
    """
    if not old_content:
        return

    # Helper function to find all /uploads/ URLs
    def find_uploads(content: str) -> Set[str]:
        if not content:
            return set()
        # Find all src="/uploads/..."
        return set(re.findall(r'src="(/uploads/[^"]+)"', content))

    old_images = find_uploads(old_content)
    new_images = find_uploads(new_content)

    removed_images = old_images - new_images

    for img_url in removed_images:
        await delete_file_from_disk(img_url)
