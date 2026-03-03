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
        # Get extension from original filename (sanitized) or map content type
        # For simplicity, we trust the client extension IF it matches mime, 
        # but better to rely on original filename extension after sanitization
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
    # Structure: /media_data/module/[images|documents]/
    safe_module = sanitize_filename(module)
    save_dir = UPLOAD_ROOT / safe_module / subdir
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
        "path": f"/media/{safe_module}/{subdir}/{filename}",
        "hash": file_hash
    }

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Media Fortress"}
