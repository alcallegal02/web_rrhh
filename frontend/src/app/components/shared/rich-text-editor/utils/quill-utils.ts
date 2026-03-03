/**
 * Utilidades consolidadas para trabajar con Quill
 * Incluye: imágenes, operaciones, rangos, helpers y configuración
 */

import { applyImageStyles, parseStyleDimensions } from './image-utils';

// ============================================================================
// CONFIGURACIÓN DE QUILL
// ============================================================================

/**
 * Tamaños de fuente permitidos (en px)
 */
export const ALLOWED_FONT_SIZES = [
  '8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px', '72px', '96px'
];

export const DEFAULT_QUILL_TOOLBAR = [
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  [{ 'font': [] }],
  [{ 'size': ALLOWED_FONT_SIZES }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub' }, { 'script': 'super' }],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  [{ 'indent': '-1' }, { 'indent': '+1' }],
  [{ 'direction': 'rtl' }],
  [{ 'align': [] }],
  ['link', 'image', 'video'],
  ['clean'],
  ['blockquote', 'code-block']
];

export function createQuillModulesConfig(toolbar?: any[]): any {
  return {
    toolbar: toolbar || DEFAULT_QUILL_TOOLBAR
  };
}

export function isQuillAvailable(quillInstance: any): boolean {
  return quillInstance &&
    typeof quillInstance.getModule === 'function' &&
    typeof quillInstance.getSelection === 'function';
}

export function getQuillToolbar(quillInstance: any): any | null {
  if (!isQuillAvailable(quillInstance)) {
    return null;
  }

  try {
    return quillInstance.getModule('toolbar');
  } catch {
    return null;
  }
}

/**
 * Registra el configurador de tamaño de fuente en Quill para usar estilos inline (px)
 * @param Quill Clase de Quill (generalmente importada desde 'quill')
 */
export function registerFontSizeAttributor(Quill: any): void {
  if (!Quill) return;

  try {
    const SizeStyle = Quill.import('attributors/style/size');
    // Definimos los tamaños permitidos para el attributor
    // Quill usará font-size: {value}px si el valor está en la lista de whitelist
    SizeStyle.whitelist = ALLOWED_FONT_SIZES;

    Quill.register(SizeStyle, true);
  } catch (error) {
    console.error('Error al registrar FontSizeAttributor:', error);
  }
}

// ============================================================================
// UTILIDADES DE IMÁGENES EN QUILL
// ============================================================================

export function getElementIndexInQuill(
  quillInstance: any,
  container: HTMLElement,
  element: HTMLElement,
  currentIndex: number | null = null
): number | null {
  try {
    if (!quillInstance || !element) {
      return null;
    }

    if (!container.contains(element)) {
      return null;
    }

    const targetBlot = quillInstance.scroll.find(element);
    if (!targetBlot) {
      return null;
    }

    const blotIndex = quillInstance.getIndex(targetBlot);
    return blotIndex !== null && blotIndex !== undefined ? blotIndex : currentIndex;
  } catch (error) {
    return null;
  }
}

export function findResizableElementBySrc(
  editorElement: HTMLElement,
  src: string
): HTMLElement | null {
  const elements = Array.from(editorElement.querySelectorAll('img, iframe, div.image-resizable, .ql-video-wrapper')) as HTMLElement[];

  const normalizeUrl = (url: string): string => {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname;
    } catch {
      return url.startsWith('/') ? url : `/${url}`;
    }
  };

  const normalizedSrc = normalizeUrl(src);

  const foundElement = elements.find((el: any) => {
    const elSrc = el.src || '';
    const elNormalizedSrc = normalizeUrl(elSrc);
    return elNormalizedSrc === normalizedSrc || elSrc === src || elSrc.includes(src) || src.includes(elSrc);
  });

  return foundElement || null;
}

// ============================================================================
// OPERACIONES DE QUILL
// ============================================================================

export function getSafeQuillIndex(quill: any, preferredIndex?: number): number {
  const length = quill.getLength();

  if (preferredIndex !== undefined && preferredIndex >= 0) {
    return Math.max(0, Math.min(preferredIndex, Math.max(0, length - 1)));
  }

  return Math.max(0, length - 1);
}

export function insertImageSafely(
  quill: any,
  imageUrl: string,
  index?: number
): boolean {
  try {
    const safeIndex = getSafeQuillIndex(quill, index);
    quill.insertEmbed(safeIndex, 'image', imageUrl, 'user');
    return true;
  } catch {
    return false;
  }
}

export function getQuillSelection(quill: any): { index: number; length: number } | null {
  try {
    const selection = quill.getSelection(false);
    return selection && selection.index !== null ? selection : null;
  } catch {
    return null;
  }
}

export function setQuillSelection(
  quill: any,
  index: number,
  length: number = 0,
  source: 'user' | 'api' | 'silent' = 'silent'
): boolean {
  try {
    quill.setSelection(index, length, source);
    return true;
  } catch {
    return false;
  }
}

// Función moveImageInQuill simplificada - se mantiene la versión completa en el archivo original
export function moveImageInQuill(
  quill: any,
  oldIndex: number,
  newIndex: number,
  imageUrl: string, // NOTE: For videos, this might be the video URL object or string
  dimensions?: { width: string; height: string; style: string; naturalWidth: number; naturalHeight: number },
  hasNewlineBetween?: boolean,
  embedType: string = 'image'
): boolean {
  try {
    const lengthBefore = quill.getLength();

    if (oldIndex < 0 || oldIndex >= lengthBefore) {
      return false;
    }

    quill.deleteText(oldIndex, 1, 'silent');
    const lengthAfterDelete = quill.getLength();

    const adjustedIndex = (newIndex > oldIndex) ? newIndex - 1 : newIndex;

    if (adjustedIndex < 0 || adjustedIndex > lengthAfterDelete) {
      return false;
    }

    // Preparar el valor a insertar
    let insertionValue: any = imageUrl;

    // Si es un video, usamos un objeto para mantener consistencia con VideoBlot.value
    // PERO NO incluimos width/height aquí, para que sean tratados como atributos (formatos)
    // y no colisionen con el valor. El tamaño se aplica vía formatText abajo.
    if (embedType === 'video') {
      insertionValue = {
        url: imageUrl
        // align se podría extraer del estilo si fuera necesario, pero por ahora lo dejamos
      };
    }

    quill.insertEmbed(adjustedIndex, embedType, insertionValue, 'user');

    if (dimensions) {

      const dims = parseStyleDimensions(dimensions.style || '');
      const widthToApply = dims.width || dimensions.width;
      const heightToApply = dims.height || dimensions.height;

      // 1. Aplicar formatos directamente a Quill para actualizar el Delta
      // Esto es crucial para la persistencia real si Quill re-renderiza
      if (widthToApply && heightToApply) {
        quill.formatText(adjustedIndex, 1, 'width', widthToApply, 'user');
        quill.formatText(adjustedIndex, 1, 'height', heightToApply, 'user');
      }

      // 2. Aplicar estilos al DOM via requestAnimationFrame como respaldo visual inmediato
      requestAnimationFrame(() => {
        const editorElement = quill.root;
        const targetImage = findResizableElementBySrc(editorElement, imageUrl);

        if (targetImage) {
          if (widthToApply && heightToApply) {
            // Usar la utilidad centralizada para asegurar consistencia con el comportamiento de resize
            applyImageStyles(
              targetImage,
              dimensions.style || `width: ${widthToApply}; height: ${heightToApply}`,
              widthToApply,
              heightToApply,
              quill
            );
          }
        }
      });
    }

    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// RANGOS Y SELECCIÓN
// ============================================================================

export function getRangeFromPoint(x: number, y: number): Range | null {
  try {
    return document.caretRangeFromPoint
      ? document.caretRangeFromPoint(x, y)
      : (document as any).caretPositionFromPoint?.(x, y) || null;
  } catch {
    return null;
  }
}

export function isPointInRect(
  x: number,
  y: number,
  rect: DOMRect
): boolean {
  return x >= rect.left && x <= rect.right &&
    y >= rect.top && y <= rect.bottom;
}

/**
 * Obtiene el índice de Quill desde coordenadas del mouse
 * Versión mejorada que calcula el índice preciso
 */
export function getQuillIndexFromPoint(
  quillInstance: any,
  x: number,
  y: number
): number | null {
  if (!quillInstance || !quillInstance.root) {
    return null;
  }

  try {
    const range = getRangeFromPoint(x, y);
    if (!range) {
      return null;
    }

    const editorElement = quillInstance.root;
    const editorRect = editorElement.getBoundingClientRect();

    if (x < editorRect.left || x > editorRect.right ||
      y < editorRect.top || y > editorRect.bottom) {
      return null;
    }

    // Método 1: Intentar usar getBounds con el range directamente
    try {
      const bounds = quillInstance.getBounds(range.startContainer, range.startOffset);
      if (bounds && bounds.index !== undefined) {
        return bounds.index;
      }
    } catch (e) {
    }

    // Método 2: Usar getLeaf para obtener el blot y luego el índice
    try {
      // Primero intentar obtener el leaf desde el nodo de texto si es posible
      let containerNode = range.startContainer;
      let offset = range.startOffset;

      // Si el startContainer es un elemento, buscar el nodo de texto dentro
      if (containerNode.nodeType === Node.ELEMENT_NODE) {
        const element = containerNode as Element;
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null
        );

        let textNode: Text | null = null;
        let accumulatedLength = 0;

        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const nodeLength = node.textContent?.length || 0;

          if (accumulatedLength + nodeLength >= offset) {
            textNode = node;
            offset = offset - accumulatedLength;
            break;
          }

          accumulatedLength += nodeLength;
        }

        if (textNode) {
          containerNode = textNode;
        }
      }

      const leaf = quillInstance.getLeaf(containerNode, offset);
      if (leaf && leaf[0]) {
        const leafBlot = leaf[0];
        const leafIndex = quillInstance.getIndex(leafBlot);

        // Calcular el offset dentro del leaf si es texto
        if (containerNode.nodeType === Node.TEXT_NODE) {
          const textOffset = offset;
          const finalIndex = leafIndex + textOffset;
          return finalIndex;
        } else {
          return leafIndex;
        }
      }
    } catch (e) {
    }

    // Método 3: Establecer selección temporal y obtener índice
    try {
      const selection = window.getSelection();
      if (selection) {
        const previousRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

        // Crear un nuevo range más preciso
        const preciseRange = document.createRange();
        let containerNode = range.startContainer;
        let offset = range.startOffset;

        // Si es un elemento, buscar el nodo de texto más cercano
        if (containerNode.nodeType === Node.ELEMENT_NODE) {
          const element = containerNode as Element;
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
          );

          let closestTextNode: Text | null = null;
          let closestDistance = Infinity;

          while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            const tempRange = document.createRange();
            tempRange.selectNodeContents(textNode);
            const rect = tempRange.getBoundingClientRect();

            // Calcular distancia desde el punto Y
            const distance = Math.abs(y - (rect.top + rect.height / 2));
            if (distance < closestDistance) {
              closestDistance = distance;
              closestTextNode = textNode;
            }
          }

          if (closestTextNode) {
            containerNode = closestTextNode;
            // Calcular offset basándose en la posición X
            const textContent = closestTextNode.textContent || '';
            const tempRange = document.createRange();
            let bestOffset = 0;
            let minDistance = Infinity;

            for (let i = 0; i <= textContent.length; i++) {
              tempRange.setStart(closestTextNode, i);
              tempRange.setEnd(closestTextNode, i);
              const charRect = tempRange.getBoundingClientRect();

              if (charRect.width > 0 || i === 0 || i === textContent.length) {
                const distance = Math.abs(x - charRect.left);
                if (distance < minDistance) {
                  minDistance = distance;
                  bestOffset = i;

                }
              }
            }

            offset = bestOffset;
          }
        }

        preciseRange.setStart(containerNode, offset);
        preciseRange.setEnd(containerNode, offset);

        selection.removeAllRanges();
        selection.addRange(preciseRange);

        const quillSelection = quillInstance.getSelection(true);
        if (quillSelection && quillSelection.index !== null && quillSelection.index !== undefined) {
          const index = quillSelection.index;

          // Restaurar selección anterior
          if (previousRange) {
            selection.removeAllRanges();
            selection.addRange(previousRange);
          } else {
            selection.removeAllRanges();
          }

          return index;
        }

        // Restaurar selección anterior
        if (previousRange) {
          selection.removeAllRanges();
          selection.addRange(previousRange);
        } else {
          selection.removeAllRanges();
        }
      }
    } catch (e) {
    }

    // Método 4: Fallback - buscar el índice más cercano
    const editorLength = quillInstance.getLength();
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < editorLength; i++) {
      try {
        const bounds = quillInstance.getBounds(i);
        if (bounds) {
          const distance = Math.abs(bounds.left - x) + Math.abs(bounds.top - y);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
          }
        }
      } catch {
        // Continuar
      }
    }

    return closestIndex;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// HELPERS DE QUILL
// ============================================================================

function hasDimensions(style: string): boolean {
  return style.includes('width:') && style.includes('height:');
}

export function applyStylesToQuillElements(
  quillInstance: any,
  elementStyles: Map<string, string>
): void {
  if (!quillInstance || !elementStyles || elementStyles.size === 0) return;

  const allElements = quillInstance.root.querySelectorAll('img, iframe, div.image-resizable, div.ql-video-wrapper');
  allElements.forEach((el: HTMLElement) => {
    const src = (el as any).src;
    const style = elementStyles.get(src);
    if (style) {
      applyImageStyles(el, style, '', '', quillInstance);
    }
  });
}

export function preserveElementStylesInHTML(
  html: string,
  elementStyles: Map<string, string>
): string {
  if (!html || !elementStyles || elementStyles.size === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('img, iframe, div.image-resizable, div.ql-video-wrapper');

  elements.forEach((el: any) => {
    const src = el.src;
    const style = elementStyles.get(src);
    if (style) {
      el.setAttribute('style', style);
    }
  });

  return doc.body.innerHTML;
}

/**
 * Registra el configurador de video en Quill para usar estilos inline y asegurar persistencia
 * @param Quill Clase de Quill
 */
export function registerVideoAttributor(Quill: any): void {
  if (!Quill) return;

  try {
    const BlockEmbed = Quill.import('blots/block/embed');

    class VideoBlot extends BlockEmbed {
      static create(value: string | any) {
        let url = typeof value === 'string' ? value : value.url;
        const node = super.create();

        node.setAttribute('contenteditable', 'false');
        node.classList.add('ql-video-wrapper');
        node.classList.add('image-resizable');

        // Atributo src en el contenedor para identificación por ImageResizeHandler
        node.setAttribute('src', url);
        (node as any).src = url;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', url);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');

        // Estilos base para el iframe
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.display = 'block';
        iframe.style.pointerEvents = 'none';

        // Estilos por defecto para el contenedor
        node.style.display = 'block';
        node.style.margin = '10px auto';
        node.style.maxWidth = '100%';
        node.style.width = '560px';
        node.style.height = '315px';
        node.style.position = 'relative';
        // node.style.borderRadius = '8px'; // Removed to ensure alignment with resize handles
        node.style.boxSizing = 'border-box'; // Ensure dimensions include padding/border
        node.style.cursor = 'pointer';

        // Aplicar formatos iniciales si vienen en el objeto value
        if (typeof value === 'object') {
          if (value.width) node.style.width = value.width;
          if (value.height) node.style.height = value.height;
          if (value.align) {
            node.setAttribute('data-align', value.align);
            if (value.align === 'center') {
              node.style.marginLeft = 'auto';
              node.style.marginRight = 'auto';
            } else if (value.align === 'right') {
              node.style.marginLeft = 'auto';
              node.style.marginRight = '0';
            } else {
              node.style.marginLeft = '0';
              node.style.marginRight = 'auto';
            }
          }
        }

        // Capa transparente para capturar clicks
        const overlay = document.createElement('div');
        overlay.setAttribute('style', 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;');
        overlay.className = 'ql-video-overlay';

        node.appendChild(iframe);
        node.appendChild(overlay);


        // Verificar inmediatamente si se creó bien


        return node;
      }

      static formats(node: HTMLElement) {
        const format: any = {};
        if (node.style.width) format.width = node.style.width;
        if (node.style.height) format.height = node.style.height;
        if (node.getAttribute('data-align')) format.align = node.getAttribute('data-align');
        return format;
      }

      static value(node: HTMLElement) {
        const iframe = node.querySelector('iframe');
        const url = iframe ? iframe.getAttribute('src') : node.getAttribute('src');

        if (!iframe) {
          // console.warn('⚠️ [VIDEO BLOT] value() called but NO IFRAME found inside wrapper!', node);
        }

        // Return only the URL (and align) to force width/height to be treated as formats (attributes)
        // This prevents conflict between value and attributes which caused size loss
        return {
          url: url,
          align: node.getAttribute('data-align')
        };

      }

      format(name: string, value: any) {
        if (name === 'width' || name === 'height') {
          if (value) {
            this['domNode'].style[name] = value;
          } else {
            this['domNode'].style[name] = '';
          }
        } else if (name === 'align') {
          if (value) {
            this['domNode'].setAttribute('data-align', value);
            if (value === 'center') {
              this['domNode'].style.marginLeft = 'auto';
              this['domNode'].style.marginRight = 'auto';
            } else if (value === 'right') {
              this['domNode'].style.marginLeft = 'auto';
              this['domNode'].style.marginRight = '0';
            } else {
              this['domNode'].style.marginLeft = '0';
              this['domNode'].style.marginRight = 'auto';
            }
          } else {
            this['domNode'].removeAttribute('data-align');
            this['domNode'].style.marginLeft = 'auto';
            this['domNode'].style.marginRight = 'auto';
          }
        } else {
          super.format(name, value);
        }
      }
    }

    (VideoBlot as any).blotName = 'video';
    (VideoBlot as any).tagName = 'div';
    (VideoBlot as any).className = 'ql-video-wrapper';

    Quill.register(VideoBlot, true);
  } catch (error) {
    console.error('Error al registrar VideoAttributor:', error);
  }
}

/**
 * Envuelve iframes de video existentes en el contenedor con overlay
 * Útil para migrar contenido antiguo o que no pasó por el Blot
 */
export function wrapExistingVideos(container: HTMLElement): void {
  const iframes = container.querySelectorAll('iframe:not(.ql-video-wrapper iframe)');

  iframes.forEach((iframe: any) => {
    // Solo envolver si parece ser un video (YouTube, Vimeo, etc.)
    const src = iframe.getAttribute('src') || '';
    if (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com')) {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('contenteditable', 'false');
      wrapper.className = 'ql-video-wrapper image-resizable';
      wrapper.setAttribute('src', src);
      (wrapper as any).src = src;

      // Aplicar estilos del iframe al wrapper si los tiene
      const style = iframe.getAttribute('style') || '';
      wrapper.setAttribute('style', `
        display: block; 
        margin: 10px auto; 
        max-width: 100%; 
        width: ${iframe.getAttribute('width') || '560'}px; 
        height: ${iframe.getAttribute('height') || '315'}px; 
        position: relative; 
        border-radius: 8px; 
        cursor: pointer;
        ${style}
      `);

      const newIframe = iframe.cloneNode(true) as HTMLElement;
      newIframe.style.width = '100%';
      newIframe.style.height = '100%';
      newIframe.style.display = 'block';
      newIframe.style.pointerEvents = 'none';

      const overlay = document.createElement('div');
      overlay.setAttribute('style', 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;');
      overlay.className = 'ql-video-overlay';

      wrapper.appendChild(newIframe);
      wrapper.appendChild(overlay);

      iframe.parentNode?.replaceChild(wrapper, iframe);
    }
  });
}
