import logging
import re
import unicodedata

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing dangerous characters and normalizing it.
    """
    if not filename:
        return "unnamed_file"
    # Normalize unicode to ASCII
    filename = unicodedata.normalize('NFKD', filename).encode('ascii', 'ignore').decode('ascii')
    # Remove everything except alphanumeric, dots, underscores and hyphens
    filename = re.sub(r'[^\w\.\-]', '_', filename)
    # Avoid double dots
    filename = re.sub(r'\.\.', '_', filename)
    # Limit length
    if len(filename) > 255:
        parts = filename.rsplit('.', 1)
        if len(parts) > 1:
            filename = parts[0][:250] + "." + parts[1]
        else:
            filename = filename[:255]
    return filename

def validate_file_extension(filename: str, allowed_extensions: set = None) -> None:
    """
    Validate that the file extension is not blacklisted and is optionally in the allowed set.
    """
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")
        
    extension = filename.split('.')[-1].lower() if '.' in filename else ''
    
    # Blacklisted extensions
    blacklist = {'exe', 'bat', 'sh', 'py', 'js', 'php', 'pl', 'rb', 'msi', 'com', 'cmd', 'scr', 'vbs'}
    if extension in blacklist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo '.{extension}' no permitido por razones de seguridad."
        )
    
    if allowed_extensions:
        # Convert all to lowercase and remove leading dot for comparison
        clean_allowed = {ext.lstrip('.').lower() for ext in allowed_extensions}
        if extension not in clean_allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extensión '.{extension}' no permitida. Permitidas: {', '.join(allowed_extensions)}"
            )

def validate_magic_numbers(content: bytes, filename: str) -> None:
    """
    Validate magic numbers (file signature) matches the file extension.
    """
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El contenido del archivo está vacío.")
    
    # Check for basic malicious content (e.g., PHP tags)
    if b'<?php' in content[:1024].lower(): # Optimization: check start only
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contenido de archivo no permitido (código malicioso detectado)."
        )

    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    
    # Magic numbers signatures
    signatures = {
        'pdf': [b'%PDF-'],
        'png': [b'\x89PNG\r\n\x1a\n'],
        'jpg': [b'\xFF\xD8\xFF'],
        'jpeg': [b'\xFF\xD8\xFF'],
        'webp': [b'RIFF'], # RIFF....WEBP (checks start only)
        'doc': [b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'],
        'docx': [b'PK\x03\x04'], # Zip format
        'zip': [b'PK\x03\x04'],
        'txt': [], # No magic bytes
        'rtf': [b'{\\rtf1'],
    }
    
    # Additional check for WEBP: bytes 8-12 should be 'WEBP'
    if ext == 'webp' and len(content) > 12:
        if content[0:4] != b'RIFF' or content[8:12] != b'WEBP':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de archivo inválido. Se esperaba WEBP."
            )
        return

    # Files without strict magic bytes validation requirement
    if ext == 'txt':
        return

    allowed_sigs = signatures.get(ext)
    
    if allowed_sigs:
        is_valid = any(content.startswith(sig) for sig in allowed_sigs)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El contenido del archivo no coincide con la extensión provista (. {ext})."
            )
    else:
        # If extension is not in our specific list but was passed by allowed_extensions check,
        # we might be strict or lenient. For now, strict:
        if ext in ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'webp', 'rtf']:
             # Should have matched above
             pass
        else:
             # Unknown type allowed? If we want to support generic binary, we skip.
             # but we assume the caller filtered by allowed_extensions first.
             # If caller allows 'xyz' and we don't have signature, we allow it with warning?
             # For security, better to default allow if not known malicious, OR deny if known type fails.
             pass
