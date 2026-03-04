import bleach
from bleach.css_sanitizer import CSSSanitizer

# Allowed HTML tags for news content
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'div', 'span',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'iframe'
]

# Allowed HTML attributes
# Note: 'class' attribute is allowed on p, div, span to preserve Quill alignment classes
# like ql-align-center, ql-align-right, ql-align-left, ql-align-justify
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'style'],
    'div': ['class', 'style'],
    'span': ['class', 'style'],
    'p': ['class', 'style'],
    'h1': ['class', 'style'],
    'h2': ['class', 'style'],
    'h3': ['class', 'style'],
    'h4': ['class', 'style'],
    'h5': ['class', 'style'],
    'h6': ['class', 'style'],
    'table': ['class', 'style'],
    'th': ['class', 'style'],
    'td': ['class', 'style'],
    'tr': ['class', 'style'],
    'ul': ['class', 'style'],
    'ol': ['class', 'style'],
    'li': ['class', 'style'],
    'blockquote': ['class', 'style'],
    'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'style', 'class']
}

# Allowed CSS properties
css_sanitizer = CSSSanitizer(allowed_css_properties=[
    'color', 'background-color', 'text-align', 'font-size', 'font-weight',
    'font-style', 'text-decoration', 'margin', 'padding', 'width', 'height',
    'max-width', 'max-height'
])


def sanitize_html(html: str) -> str:
    """Sanitize HTML content to prevent XSS attacks"""
    if not html:
        return ""
    
    import logging
    import re
    
    logger = logging.getLogger(__name__)
    
    # Logging removed to prevent log flooding with base64 images
    
    # Step 1: Preserve alignment classes and image tags before sanitization
    # Quill uses classes like ql-align-center, ql-align-right, ql-align-left
    # We need to preserve these classes on p, div, and other container elements
    
    # Step 2: Extract and preserve safe image tags with their parent containers
    safe_images = []
    image_counter = 0
    
    def preserve_safe_images(match):
        nonlocal image_counter
        img_tag = match.group(0)
        src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag)
        if src_match:
            url = src_match.group(1)
            # Only preserve safe URLs:
            # - Relative paths starting with /uploads/ or /media/
            # - Absolute URLs containing /uploads/ or /media/ (for development)
            # - Data URLs for inline images
            if (url.startswith('/uploads/') or 
                url.startswith('/media/') or
                '/uploads/' in url or 
                '/media/' in url or
                url.startswith('data:image/')):
                placeholder = f"__PRESERVED_IMG_{image_counter}__"
                safe_images.append((placeholder, img_tag))
                image_counter += 1
                return placeholder
        return ''  # Remove unsafe images
    
    # Replace safe images with placeholders
    html_with_placeholders = re.sub(r'<img[^>]*>', preserve_safe_images, html)
    
    # Step 3: Sanitize HTML with bleach
    # Ensure alignment classes are preserved by allowing them in the sanitizer
    protocols = bleach.ALLOWED_PROTOCOLS.union(['data'])
    cleaned = bleach.clean(
        html_with_placeholders,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        protocols=protocols,
        strip=True
    )
    
    # Step 4: Restore preserved safe images and normalize URLs
    for placeholder, img_tag in safe_images:
        # Normalize image URLs to use relative paths
        # Convert absolute URLs like http://localhost/uploads/... to /uploads/...
        # Also handles /media/ paths
        normalized_tag = re.sub(
            r'src=["\'](https?://[^/]+)?((?:/uploads/|/media/)[^"\']+)["\']',
            r'src="\2"',
            img_tag
        )
        cleaned = cleaned.replace(placeholder, normalized_tag)
    
    # Logging removed
    
    # Step 5: Ensure alignment classes are preserved on container elements
    # Quill may wrap images in <p> or <div> with ql-align-* classes
    # Make sure these classes are not stripped
    # This is handled by allowing 'class' attribute on p and div in ALLOWED_ATTRIBUTES
    
    return cleaned

