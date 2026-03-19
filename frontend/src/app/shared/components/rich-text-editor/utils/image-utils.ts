/**
 * Utilidades consolidadas para manipulación de imágenes en el editor
 * Incluye: DOM, estilos, preservación y restauración
 */

import { ImageStyleManager, ImageStyle } from '../services/image-style-manager.service';
import { DEFAULT_IMAGE_SIZE, MAX_WIDTH_NONE, MAX_HEIGHT_NONE, DIMENSION_TOLERANCE } from './constants';
import { findResizableElementBySrc } from './quill-utils';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ImageDimensions {
  width: number;
  height: number;
}

// ============================================================================
// MANIPULACIÓN DEL DOM
// ============================================================================

/**
 * Obtiene las dimensiones de una imagen desde diferentes fuentes
 */
export function getImageDimensions(el: HTMLElement): ImageDimensions {
  const rect = el.getBoundingClientRect();
  let width = rect.width;
  let height = rect.height;

  if (!width || !height || isNaN(width) || isNaN(height)) {
    const styleWidth = el.style.width;
    const styleHeight = el.style.height;
    if (styleWidth && styleHeight) {
      width = parseFloat(styleWidth) || DEFAULT_IMAGE_SIZE;
      height = parseFloat(styleHeight) || DEFAULT_IMAGE_SIZE;
    } else {
      width = (el as any).naturalWidth || (el as any).width || DEFAULT_IMAGE_SIZE;
      height = (el as any).naturalHeight || (el as any).height || DEFAULT_IMAGE_SIZE;
    }
  }

  return { width, height };
}

/**
 * Obtiene las dimensiones actuales de una imagen desde sus estilos
 */
export function getCurrentImageDimensions(el: HTMLElement): { width: string; height: string } {
  const styleWidth = el.style.width;
  const styleHeight = el.style.height;

  if (styleWidth && styleHeight) {
    return { width: styleWidth, height: styleHeight };
  }

  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0 && !isNaN(rect.width) && !isNaN(rect.height)) {
    return {
      width: `${rect.width}px`,
      height: `${rect.height}px`
    };
  }

  return {
    width: `${(el as any).naturalWidth || (el as any).width || DEFAULT_IMAGE_SIZE}px`,
    height: `${(el as any).naturalHeight || (el as any).height || DEFAULT_IMAGE_SIZE}px`
  };
}

/**
 * Extrae valores de width y height de un string de estilo
 */
export function parseStyleDimensions(style: string): { width: string; height: string } {
  // Regex mejorado para evitar coincidir con 'max-width' o 'min-width'
  const widthMatch = style.match(/(?:^|[\s;])width:\s*([^;]+)/);
  const heightMatch = style.match(/(?:^|[\s;])height:\s*([^;]+)/);

  return {
    width: widthMatch ? widthMatch[1].trim() : '',
    height: heightMatch ? heightMatch[1].trim() : ''
  };
}

/**
 * Verifica si una imagen tiene estilos de tamaño aplicados
 */
export function hasImageSizeStyles(img: HTMLElement): boolean {
  return !!(img.style.width && img.style.height);
}

// ============================================================================
// APLICACIÓN DE ESTILOS
// ============================================================================

/**
 * Aplica estilos a una imagen y su blot de Quill
 */
export function applyImageStyles(
  img: HTMLElement,
  style: string,
  width: string,
  height: string,
  quillInstance?: any
): void {
  // SAFE GUARD: Validar que el estilo no esté vacío o sea inválido para videos
  if (img.classList.contains('ql-video-wrapper') && (!style || style.trim() === '')) {
    console.warn('⚠️ [APPLY STYLE] Prevented wiping styles with empty string on video wrapper!', img);
    return;
  }



  img.setAttribute('style', style);
  // FIX: Solo actualizar propiedades individuales si se proporcionan valores
  if (width) img.style.width = width;
  if (height) img.style.height = height;
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';

  if (quillInstance) {
    applyStylesToQuillBlot(img as any, style, width, height, quillInstance);
  }

  // CRÍTICO: Si es un wrapper de video, asegurar que el iframe ocupe todo el espacio
  if (img.classList.contains('ql-video-wrapper')) {
    // FORCE IMPORTANT: Recuperar la prioridad !important si se perdió
    if (img.style.width) img.style.setProperty('width', img.style.width, 'important');
    if (img.style.height) img.style.setProperty('height', img.style.height, 'important');

    const iframe = img.querySelector('iframe');
    if (iframe) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
    } else {
      console.warn('⚠️ [APPLY STYLE] Video Wrapper found but NO IFRAME child!');
    }
  }
}

/**
 * Aplica estilos básicos de tamaño a una imagen
 */
export function applyBasicImageStyles(
  img: HTMLElement,
  width: string,
  height: string
): void {
  img.style.width = width;
  img.style.height = height;
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';
}

/**
 * Aplica estilos durante el resize con !important para evitar que Quill los sobrescriba
 */
export function applyResizeStyles(
  img: HTMLElement,
  width: string,
  height: string
): void {
  img.style.setProperty('width', width, 'important');
  img.style.setProperty('height', height, 'important');
  img.style.setProperty('max-width', 'none', 'important');
  img.style.setProperty('max-height', 'none', 'important');

  // CRÍTICO: Si es un wrapper de video, asegurar que el iframe ocupe todo el espacio
  if (img.classList.contains('ql-video-wrapper')) {
    const iframe = img.querySelector('iframe');
    if (iframe) {
      iframe.style.setProperty('width', '100%', 'important');
      iframe.style.setProperty('height', '100%', 'important');
    }
  }



  // No sobrescribir el atributo style completo para preservar otras propiedades (como margin, display, position)
  // img.setAttribute('style', styleString);

  void img.offsetHeight; // Forzar reflow
}

/**
 * Aplica estilos al blot de Quill de una imagen
 */
export function applyStylesToQuillBlot(
  img: HTMLElement,
  style: string,
  width: string,
  height: string,
  quillInstance: any
): void {
  const blot = quillInstance.scroll.find(img);
  if (blot && blot.domNode) {
    const imgNode = blot.domNode as HTMLElement;
    imgNode.setAttribute('style', style);
    imgNode.style.width = width;
    imgNode.style.height = height;
    imgNode.style.maxWidth = 'none';
    imgNode.style.maxHeight = 'none';
  }
}

/**
 * Aplica estilos a todas las imágenes con el mismo src en el editor
 */
export function applyStylesToAllImagesWithSrc(
  imageSrc: string,
  style: ImageStyle,
  quillInstance: any
): void {
  if (!quillInstance) return;

  // Buscar también los wrappers de video
  const allElements = quillInstance.root.querySelectorAll('img, iframe, .ql-video-wrapper');
  allElements.forEach((el: HTMLElement) => {
    // Evitar aplicar estilos a iframes que son hijos directos de un wrapper (el estilo va al wrapper)
    if (el.tagName.toLowerCase() === 'iframe' && el.parentElement?.classList.contains('ql-video-wrapper')) {
      return;
    }

    if ((el as any).src === imageSrc || el.getAttribute('src') === imageSrc) {
      applyImageStyles(el, style.style, style.width, style.height, quillInstance);
    }
  });
}

// ============================================================================
// CONSTRUCCIÓN Y NORMALIZACIÓN DE ESTILOS
// ============================================================================

/**
 * Normaliza un valor de dimensión asegurando que tenga el formato 'px'
 */
export function normalizeDimension(value: string | number, fallback: string = `${DEFAULT_IMAGE_SIZE}px`): string {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  if (!value) {
    return fallback;
  }

  if (value.includes('px')) {
    return value;
  }

  const numValue = parseFloat(value);
  if (!isNaN(numValue)) {
    return `${numValue}px`;
  }

  return fallback;
}

/**
 * Construye un estilo completo preservando estilos existentes
 */
export function buildImageStyle(
  width: string,
  height: string,
  existingStyle?: string
): string {
  const excludedProperties = ['width', 'height', 'max-width', 'max-height', 'user-select'];

  const styleParts = (existingStyle || '').split(';').filter(s => {
    const trimmed = s.trim().toLowerCase();
    return trimmed && !excludedProperties.some(prop => trimmed.startsWith(prop));
  });

  styleParts.push(`width: ${width}`);
  styleParts.push(`height: ${height}`);
  styleParts.push(MAX_WIDTH_NONE);
  styleParts.push(MAX_HEIGHT_NONE);

  return styleParts.join('; ').trim();
}

// ============================================================================
// PRESERVACIÓN DE ESTILOS
// ============================================================================

/**
 * Extrae y preserva estilos de una imagen
 */
export function extractImageStyle(
  img: HTMLElement,
  styleManager: ImageStyleManager
): { style: string; saved: boolean } {
  const savedStyle = styleManager.getStyleFromElement(img);

  if (savedStyle?.width && savedStyle?.height) {
    return { style: savedStyle.style, saved: true };
  }

  const currentStyle = img.getAttribute('style') || '';
  const computedWidth = img.style.width;
  const computedHeight = img.style.height;

  if (computedWidth && computedHeight) {
    const fullStyle = buildImageStyle(computedWidth, computedHeight, currentStyle);
    return { style: fullStyle, saved: false };
  }

  if (currentStyle && (currentStyle.includes('width') || currentStyle.includes('height'))) {
    return { style: currentStyle, saved: false };
  }

  return { style: '', saved: false };
}

/**
 * Preserva estilos de todos los elementos redimensionables en el editor
 */
export function preserveAllElementStyles(
  elements: NodeListOf<HTMLElement> | HTMLElement[],
  styleManager: ImageStyleManager,
  quillInstance: any
): Map<string, string> {
  const elementStyles = new Map<string, string>();
  elements.forEach((el: HTMLElement) => {
    const src = (el as any).src;
    if (src) {
      const { style } = extractImageStyle(el, styleManager);
      if (style) {
        elementStyles.set(src, style);
      }
    }
  });
  return elementStyles;
}

// ============================================================================
// RESTAURACIÓN DE ESTILOS
// ============================================================================

/**
 * Verifica si las dimensiones han cambiado significativamente
 */
function hasDimensionChanged(
  currentWidth: string,
  currentHeight: string,
  savedWidth: string,
  savedHeight: string
): boolean {
  if (currentWidth !== savedWidth || currentHeight !== savedHeight) {
    return true;
  }

  const savedWidthNum = parseFloat(savedWidth);
  const savedHeightNum = parseFloat(savedHeight);
  const currentWidthNum = parseFloat(currentWidth);
  const currentHeightNum = parseFloat(currentHeight);

  return Math.abs(currentWidthNum - savedWidthNum) > DIMENSION_TOLERANCE ||
    Math.abs(currentHeightNum - savedHeightNum) > DIMENSION_TOLERANCE;
}

/**
 * Restaura los estilos de una imagen si se han perdido
 */
export function restoreImageStyleIfNeeded(
  image: HTMLElement,
  savedStyle: ImageStyle,
  quillInstance: any
): boolean {
  const currentWidth = image.style.width;
  const currentHeight = image.style.height;

  if (currentWidth !== savedStyle.width || currentHeight !== savedStyle.height) {
    applyImageStyles(image, savedStyle.style, savedStyle.width, savedStyle.height, quillInstance);
    return true;
  }

  return false;
}

/**
 * Restaura estilos después de que Quill procese cambios
 */
export function restoreStylesAfterQuillUpdate(
  imageRef: any,
  imageSrc: string,
  savedStyle: ImageStyle,
  quillInstance: any,
  editorElement: HTMLElement,
  onImageFound?: (img: any) => void,
  onStyleRestored?: (img: any) => void
): void {
  requestAnimationFrame(() => {
    let currentImage = imageRef;
    const needsReplacement = !editorElement.contains(imageRef) || (imageRef as any).src !== imageSrc;

    if (needsReplacement) {
      const foundImage = findResizableElementBySrc(editorElement, imageSrc);
      if (!foundImage) return;
      currentImage = foundImage;
      onImageFound?.(foundImage);
    }

    if (hasDimensionChanged(
      currentImage.style.width,
      currentImage.style.height,
      savedStyle.width,
      savedStyle.height
    )) {
      if (restoreImageStyleIfNeeded(currentImage as any, savedStyle, quillInstance)) {
        onStyleRestored?.(currentImage);
      }
    }
  });
}
