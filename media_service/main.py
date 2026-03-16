import os
import io
import shutil
import hashlib
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps 
import aiofiles

app = FastAPI(title="Media Fortress", version="1.0.0")

# Security: Only allow internal network or specific proxies
# In Docker, we trust the internal network.

UPLOAD_ROOT = Path("/media_data")
ALLOWED_DOC_TYPES = {
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", 
    "application/rtf"
}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"}
MAX_IMAGE_SIZE_MB = 10 * 1024 * 1024
MAX_DOC_SIZE_MB = 50 * 1024 * 1024

@app.on_event("startup")
async def startup_event():
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    return "".join(c for c in filename if c.isalnum() or c in ('-', '_', '.')).lower()

def get_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def optimize_image(content: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(content)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ("CMYK", "P"):
                img = img.convert("RGB")
            output = io.BytesIO()
            img.save(output, format="WEBP", quality=80, method=6)
            return output.getvalue()
    except Exception as e:
        print(f"Image Optimization Failed: {e}")
        raise HTTPException(status_code=400, detail="Corrupt or malformed image file")

@app.post("/upload/file")
async def upload_file(
    file: UploadFile = File(...), 
    module: str = Form("common"),
    entity_id: Optional[str] = Form(None),
    type: str = Form("document") # 'image' or 'document'
):
    content = await file.read()
    
    # 1. Processing Logic
    if type == "image":
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid image type: {file.content_type}")
        
        try:
            # Sanitize & Optimize
            clean_content = optimize_image(content)
            extension = "webp"
            subdir = "images"
            content_type = "image/webp"
        except Exception:
            raise HTTPException(status_code=400, detail="Failed to process image")
            
    elif type == "document":
        if file.content_type not in ALLOWED_DOC_TYPES:
             raise HTTPException(status_code=400, detail=f"Invalid document type: {file.content_type}")
        
        # Documents are stored RAW but hashed
        clean_content = content
        orig_ext = Path(file.filename).suffix.lower().lstrip('.')
        if not orig_ext:
            orig_ext = "dat"
        extension = orig_ext
        subdir = "documents"
        content_type = file.content_type
        
    else:
        raise HTTPException(status_code=400, detail="Invalid upload type")

    # 2. Hash & Deduplicate
    file_hash = get_file_hash(clean_content)
    filename = f"{file_hash}.{extension}"
    
    # 3. Secure Storage Path
    # New Structure: /media_data/module/[entity_id|common]/[images|documents]/
    safe_module = sanitize_filename(module)
    safe_entity = sanitize_filename(entity_id) if entity_id else "common"
    
    save_dir = UPLOAD_ROOT / safe_module / safe_entity / subdir
    save_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = save_dir / filename
    
    # 4. Save if new
    if not file_path.exists():
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(clean_content)
            
    # Return path relative to the Nginx mount
    return {
        "filename": filename,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": len(clean_content),
        "path": f"/media/{safe_module}/{safe_entity}/{subdir}/{filename}",
        "hash": file_hash
    }

def remove_empty_parents(path: Path):
    """
    Recursively remove empty parent directories up to UPLOAD_ROOT.
    """
    # Start with the parent of the deleted file
    current = path.parent
    
    # Don't delete UPLOAD_ROOT itself or anything above it
    while current != UPLOAD_ROOT and current.exists() and current.is_dir():
        # Check if directory is empty
        if not any(current.iterdir()):
            try:
                current.rmdir()
                print(f"Removed empty directory: {current}")
                current = current.parent # Move up
            except Exception as e:
                print(f"Failed to remove directory {current}: {e}")
                break # Stop if we can't delete
        else:
            break # Not empty, stop

@app.delete("/delete/file")
async def delete_file(path: str):
    """
    Securely delete a file within the UPLOAD_ROOT.
    Expects a path relative to the Nginx mount (e.g., /media/module/...) 
    or just the internal path.
    """
    # 1. Normalize path
    # If it starts with /media/, remove it
    clean_path = path.lstrip('/')
    if clean_path.startswith('media/'):
        clean_path = clean_path.replace('media/', '', 1)
        
    target_path = (UPLOAD_ROOT / clean_path).resolve()
    
    # 2. Security: Ensure the path is within UPLOAD_ROOT
    if not str(target_path).startswith(str(UPLOAD_ROOT.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
        
    # 3. Delete if exists
    if target_path.exists() and target_path.is_file():
        try:
            target_path.unlink()
            
            # 4. Cleanup empty parents
            remove_empty_parents(target_path)
            
            return {"status": "deleted", "path": path}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    
    return {"status": "not_found", "path": path}

@app.delete("/delete/folder")
async def delete_folder(module: str, entity_id: str):
    """
    Securely delete all media folders related to a specific entity ID.
    Example: Deletes /media_data/news/1234/
    """
    safe_module = sanitize_filename(module)
    safe_entity = sanitize_filename(entity_id)
    
    if safe_entity == "common":
        raise HTTPException(status_code=400, detail="Cannot delete common folder")
        
    target_dir = UPLOAD_ROOT / safe_module / safe_entity
    
    if target_dir.exists() and target_dir.is_dir():
        try:
            shutil.rmtree(target_dir)
            return {"status": "success", "deleted_folder": str(target_dir)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete folder {target_dir}: {e}")
                    
    return {"status": "not_found", "path": str(target_dir)}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Media Fortress"}
