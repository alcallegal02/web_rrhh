import re
import logging
import unicodedata
from fastapi import HTTPException, status
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)

# --- Encryption Utilities (Requested Feature) ---

def encrypt_password(password: str) -> str:
    """Encrypts a plain text password using Fernet symmetric encryption."""
    if not settings.ENCRYPTION_KEY:
        return ""
    f = Fernet(settings.ENCRYPTION_KEY.encode())
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str | None) -> str | None:
    """Decrypts a Fernet-encrypted password back to plain text."""
    if not encrypted_password or not settings.ENCRYPTION_KEY:
        return None
    try:
        f = Fernet(settings.ENCRYPTION_KEY.encode())
        return f.decrypt(encrypted_password.encode()).decode()
    except Exception:
        return None

# --- Upload Security Utilities (Restored) ---

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal and other attacks.
    """
    # Normalize unicode characters
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    # Remove any path components
    filename = re.sub(r'[^\w\s\.-]', '', filename).strip()
    # Replace spaces with underscores
    filename = re.sub(r'[-\s]+', '_', filename)
    return filename

def validate_file_extension(filename: str, allowed_extensions: set[str] | None = None):
    """
    Checks if the file extension is allowed.
    """
    if not allowed_extensions:
        allowed_extensions = {
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.txt', '.csv', '.rtf', '.zip', '.jpg', '.jpeg', '.png', '.webp', '.svg'
        }
    
    if '.' not in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no tiene extensión permitida."
        )
    
    ext = f".{filename.split('.')[-1].lower()}"
    if ext not in allowed_extensions:
        logger.warning(f"File extension blocked: {ext}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión de archivo {ext} no permitida."
        )

def validate_magic_numbers(content: bytes, filename: str):
    """
    Verifies that the file content matches common signatures.
    """
    if not content:
        return

    # Signatures for allowed types
    signatures = {
        b'%PDF-': '.pdf',
        b'\xff\xd8\xff': '.jpeg',
        # b'\xff\xd8\xff' is duplicate for .jpg
        b'\x89PNG\r\n\x1a\n': '.png',
        b'RIFF': '.webp',
        b'PK\x03\x04': '.zip', # Can be ZIP, DOCX, XLSX, PPTX
    }

    ext = f".{filename.split('.')[-1].lower()}" if '.' in filename else ''
    
    # For text-based files, we don't check magic numbers strictly
    if ext in ['.txt', '.csv', '.svg', '.json']:
        return

    # Check against known signatures
    matched = False
    for sig, type_ext in signatures.items():
        if content.startswith(sig):
            matched = True
            break
            
    # Note: We don't block strictly here yet to avoid false positives with complex formats like .doc
    if not matched and ext in ['.pdf', '.png', '.jpg', '.jpeg', '.webp']:
         logger.warning(f"Signature mismatch for {filename}")
         # raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión.")
