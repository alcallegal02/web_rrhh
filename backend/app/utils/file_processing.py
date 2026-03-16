import gzip
import hashlib
import io
import logging
from pathlib import Path

import aiofiles

from app.config import settings

logger = logging.getLogger(__name__)

def get_file_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of file content"""
    return hashlib.sha256(content).hexdigest()

def compress_content(content: bytes) -> bytes:
    """Compress content using Gzip"""
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode='wb') as f:
        f.write(content)
    return out.getvalue()

def decompress_content(content: bytes) -> bytes:
    """Decompress content using Gzip"""
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(content), mode='rb') as f:
            return f.read()
    except Exception as e:
        logger.warning(f"Failed to decompress content: {e}")
        return content

def is_compressed(content: bytes) -> bool:
    """Check if content is Gzip compressed"""
    return content.startswith(b'\x1f\x8b')

async def save_file_organized(content: bytes, filename: str, module: str, file_type: str, entity_id: str | None = None) -> dict:
    """
    Save a file with deduplication and organization.
    Returns a dict with url, filename, and status flags.
    """
    # 1. Hashing for deduplication
    file_hash = get_file_hash(content)
    ext = filename.split('.')[-1].lower() if '.' in filename else 'dat'
    
    # 2. Compression for documents
    is_comp = False
    if file_type == "documents" and ext in ['pdf', 'doc', 'docx', 'txt', 'rtf']:
        if not is_compressed(content):
            content = compress_content(content)
            is_comp = True
            
    # 3. Path organization
    safe_module = "".join(c for c in module if c.isalnum() or c in ('-', '_')).lower()
    safe_entity = "".join(c for c in entity_id if c.isalnum() or c in ('-', '_')).lower() if entity_id else "common"
    
    upload_dir = Path(settings.UPLOAD_DIR) / safe_module / safe_entity / file_type
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    final_filename = f"{file_hash}.{ext}"
    if is_comp:
        final_filename += ".gz"
        
    file_path = upload_dir / final_filename
    relative_url = f"/media/{safe_module}/{safe_entity}/{file_type}/{final_filename}"
    
    if file_path.exists():
        return {
            "url": relative_url,
            "filename": final_filename,
            "deduplicated": True,
            "compressed": is_comp
        }
        
    # 4. Save to disk
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
        
    return {
        "url": relative_url,
        "filename": final_filename,
        "deduplicated": False,
        "compressed": is_comp
    }
