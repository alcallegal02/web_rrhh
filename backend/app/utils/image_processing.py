from PIL import Image
import io
from typing import Tuple

def process_image_to_webp(content: bytes, quality: int = 80) -> Tuple[bytes, str]:
    """
    Converts an image from bytes to WebP format.
    Returns the processed content and the new extension ('webp').
    """
    try:
        img = Image.open(io.BytesIO(content))
        
        # Convert to RGB if necessary (WebP supports transparency, but for consistency we might want RGB)
        # However, WebP is great for transparency, so let's keep it if it's RGBA/LA
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            img = img.convert('RGBA')
        else:
            img = img.convert('RGB')
            
        output = io.BytesIO()
        # Save as WebP with the specified quality
        img.save(output, format='WEBP', quality=quality, method=6) # method=6 is slowest but best compression
        
        return output.getvalue(), 'webp'
    except Exception as e:
        # If conversion fails, we could fallback or raise. Given the requirement, we raise.
        raise ValueError(f"Failed to convert image to WebP: {str(e)}")
