/**
 * Manager para gestionar operaciones de drag and drop de imágenes
 */

import { getElementIndexInQuill, isPointInRect } from './quill-utils';
import { DRAGGING_IMAGE_CLASS, DROP_INDICATOR_CLASS, DROP_INDICATOR_COLOR } from './constants';
import { addClasses, removeClasses, getRectCenter } from './dom-utils';

export interface DragStartData {
  element: HTMLElement;
  index: number;
  position: { x: number; y: number };
  dimensions: {
    width: string;
    height: string;
    style: string;
    naturalWidth: number;
    naturalHeight: number;
  };
}

/**
 * Prepara una imagen para drag and drop
 */
export function prepareImageForDrag(
  img: HTMLElement,
  quillInstance: any,
  editorElement: HTMLElement
): DragStartData {
  addClasses(img, DRAGGING_IMAGE_CLASS);

  const rect = img.getBoundingClientRect();
  const index = getElementIndexInQuill(quillInstance, editorElement, img);
  const center = getRectCenter(rect);

  // Capturar dimensiones y estilos de la imagen
  const computedStyle = window.getComputedStyle(img);
  const styleWidth = img.style.width || computedStyle.width || `${rect.width}px`;
  const styleHeight = img.style.height || computedStyle.height || `${rect.height}px`;
  const styleAttribute = img.getAttribute('style') || '';

  const dimensions = {
    width: styleWidth,
    height: styleHeight,
    style: styleAttribute,
    naturalWidth: (img as any).naturalWidth || (img as any).width || rect.width,
    naturalHeight: (img as any).naturalHeight || (img as any).height || rect.height
  };

  return {
    element: img,
    index: index ?? -1,
    position: center,
    dimensions
  };
}

/**
 * Finaliza el drag de una imagen
 */
export function finalizeImageDrag(img: HTMLElement): void {
  removeClasses(img, DRAGGING_IMAGE_CLASS);
}

/**
 * Calcula el índice ajustado después de mover una imagen
 */
export function calculateAdjustedIndex(oldIndex: number, newIndex: number): number {
  return newIndex > oldIndex ? newIndex - 1 : newIndex;
}

/**
 * Previene el comportamiento por defecto y detiene la propagación
 */
export function preventDragDefault(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Verifica si un evento de drag está dentro del área del editor
 */
export function isDragInsideEditor(
  e: DragEvent,
  editorElement: HTMLElement
): boolean {
  const editorRect = editorElement.getBoundingClientRect();
  return isPointInRect(e.clientX, e.clientY, editorRect);
}

/**
 * Obtiene las coordenadas del evento de drag
 */
export function getDragCoordinates(e: DragEvent): { x: number; y: number } {
  return {
    x: e.clientX,
    y: e.clientY
  };
}

/**
 * Verifica si un elemento es una imagen arrastrable
 */
export function isDraggableImage(
  element: Element | null,
  resizableClass: string
): element is HTMLElement {
  return element !== null &&
    (element.tagName === 'IMG' || element.tagName === 'IFRAME' || element.tagName === 'DIV') &&
    element.classList.contains(resizableClass);
}

/**
 * Crea un indicador visual de posición de drop
 */
export function createDropIndicator(): HTMLElement {
  const indicator = document.createElement('div');
  indicator.className = DROP_INDICATOR_CLASS;
  indicator.style.cssText = `
    position: fixed !important;
    width: 4px !important;
    background: ${DROP_INDICATOR_COLOR} !important;
    pointer-events: none !important;
    z-index: 3 !important;
    border-radius: 2px !important;
    box-shadow: 0 0 4px rgba(59, 130, 246, 0.8) !important;
    margin: 0 !important;
    padding: 0 !important;
  `;
  return indicator;
}

/**
 * Actualiza la posición del indicador de drop
 * Mejorado para posicionamiento inline más preciso
 */
export function updateDropIndicatorPosition(
  indicator: HTMLElement,
  x: number,
  y: number,
  editorElement: HTMLElement
): void {
  try {
    // PRIMERO: Verificar que el punto está dentro del editor
    const editorRect = editorElement.getBoundingClientRect();
    const isInsideEditor = x >= editorRect.left && x <= editorRect.right &&
      y >= editorRect.top && y <= editorRect.bottom;
    if (!isInsideEditor) {
      // Si está fuera del editor, ocultar el indicador
      indicator.style.display = 'none';
      return;
    }

    // Obtener el rango desde el punto para posicionamiento preciso
    const range = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(x, y)
      : (document as any).caretPositionFromPoint?.(x, y) || null;

    if (range) {
      // Verificar que el rango está dentro del editor
      const rangeContainer = range.commonAncestorContainer;
      const isRangeInEditor = editorElement.contains(
        rangeContainer.nodeType === Node.TEXT_NODE
          ? rangeContainer.parentNode
          : rangeContainer
      );

      if (isRangeInEditor) {
        let textNode = range.startContainer;
        let offset = range.startOffset;

        // Si el startContainer es un elemento (como <p>), buscar el nodo de texto más cercano
        if (textNode.nodeType === Node.ELEMENT_NODE) {
          const element = textNode as Element;

          // Usar TreeWalker para encontrar el nodo de texto más cercano al punto del mouse
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
          );

          let closestTextNode: Text | null = null;
          let closestDistance = Infinity;
          let textNodesFound: Array<{ node: Text, content: string, hasVisibleChars: boolean }> = [];

          // Buscar el nodo de texto más cercano al punto Y del mouse
          let node: Node | null;
          while (node = walker.nextNode()) {
            const textNodeCandidate = node as Text;
            const textContent = textNodeCandidate.textContent || '';
            const hasVisibleChars = textContent.trim().length > 0;
            const hasAnyContent = textContent.length > 0;

            textNodesFound.push({
              node: textNodeCandidate,
              content: textContent,
              hasVisibleChars
            });

            // MODIFICADO: Considerar nodos con cualquier contenido, incluyendo solo espacios
            // Verificar si el nodo tiene contenido visible (caracteres con ancho > 0)
            if (hasAnyContent) {
              // Crear un rango para obtener la posición del nodo de texto
              const tempRange = document.createRange();
              tempRange.selectNodeContents(textNodeCandidate);
              const textRect = tempRange.getBoundingClientRect();
              // Solo considerar nodos con ancho visible (incluyendo espacios visibles)
              if (textRect.width > 0) {
                // Calcular la distancia vertical desde el punto del mouse al nodo de texto
                const distance = Math.abs(y - (textRect.top + textRect.height / 2));
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestTextNode = textNodeCandidate;
                }
              }
            }
          }

          // Si encontramos un nodo de texto cercano, usarlo
          if (closestTextNode) {
            textNode = closestTextNode;
            // Calcular el offset dentro del nodo de texto basándose en la posición X
            const textContent = closestTextNode.textContent || '';
            const tempRange = document.createRange();

            // Buscar el carácter más cercano a la posición X
            let bestOffset = 0;
            let minDistance = Infinity;
            let offsetCandidates: Array<{ offset: number, distance: number, charRect: DOMRect }> = [];

            for (let i = 0; i <= textContent.length; i++) {
              tempRange.setStart(closestTextNode, i);
              tempRange.setEnd(closestTextNode, i);
              const charRect = tempRange.getBoundingClientRect();

              if (charRect.width > 0 || i === 0 || i === textContent.length) {
                const distance = Math.abs(x - charRect.left);
                offsetCandidates.push({ offset: i, distance, charRect });

                if (distance < minDistance) {
                  minDistance = distance;
                  bestOffset = i;
                }
              }
            }

            offset = bestOffset;
          } else {
            // Si no hay nodos de texto, usar la posición exacta del cursor nativo del editor
            // Obtener el rectángulo del elemento para posicionar el indicador
            const elementRect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
            const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;

            let indicatorX = elementRect.left + paddingLeft;
            let indicatorTop = elementRect.top;
            let indicatorHeight = Math.max(Math.min(fontSize * 1.2, lineHeight), 16);

            // Intentar obtener la posición exacta del cursor nativo usando la selección temporal
            let foundValidPosition = false;
            try {
              const selection = window.getSelection();
              const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

              // Establecer temporalmente la selección en el range para obtener su posición visual
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);

                // Obtener la posición de la selección
                if (selection.rangeCount > 0) {
                  const selectionRange = selection.getRangeAt(0);
                  const selectionRect = selectionRange.getBoundingClientRect();

                  // También intentar obtener el rectángulo del cursor usando getClientRects
                  const clientRects = selectionRange.getClientRects();
                  if (clientRects.length > 0 && clientRects[0].width > 0 && clientRects[0].height > 0) {
                    const firstRect = clientRects[0];
                    indicatorX = firstRect.left;
                    indicatorTop = firstRect.top;
                    indicatorHeight = Math.max(firstRect.height, indicatorHeight);
                    foundValidPosition = true;
                  } else if (selectionRect.width > 0 && selectionRect.height > 0) {
                    indicatorX = selectionRect.left;
                    indicatorTop = selectionRect.top;
                    indicatorHeight = Math.max(selectionRect.height, indicatorHeight);
                    foundValidPosition = true;
                  }

                  // Si no encontramos una posición válida, intentar insertar un carácter temporal
                  if (!foundValidPosition && selectionRange.startContainer) {
                    try {
                      const tempChar = '\u200B'; // Zero-width space
                      const textNode = selectionRange.startContainer.nodeType === Node.TEXT_NODE
                        ? selectionRange.startContainer as Text
                        : null;

                      if (textNode) {
                        // Si es un nodo de texto, insertar el carácter temporal
                        const originalText = textNode.textContent || '';
                        const offset = selectionRange.startOffset;
                        textNode.textContent = originalText.slice(0, offset) + tempChar + originalText.slice(offset);

                        // Crear un nuevo range para el carácter temporal
                        const tempRange = document.createRange();
                        tempRange.setStart(textNode, offset);
                        tempRange.setEnd(textNode, offset + 1);

                        // Obtener la posición del carácter temporal
                        const tempRect = tempRange.getBoundingClientRect();
                        if (tempRect.width > 0 || tempRect.height > 0) {
                          indicatorX = tempRect.left;
                          indicatorTop = tempRect.top;
                          indicatorHeight = Math.max(tempRect.height, indicatorHeight);
                          foundValidPosition = true;
                        }

                        // Restaurar el texto original
                        textNode.textContent = originalText;
                      } else if (selectionRange.startContainer.nodeType === Node.ELEMENT_NODE) {
                        // Si es un elemento, crear un nodo de texto temporal
                        const element = selectionRange.startContainer as Element;
                        const textNode = document.createTextNode(tempChar);
                        const offset = selectionRange.startOffset;

                        if (offset === 0) {
                          element.insertBefore(textNode, element.firstChild);
                        } else {
                          const childNodes = Array.from(element.childNodes);
                          if (offset < childNodes.length) {
                            element.insertBefore(textNode, childNodes[offset]);
                          } else {
                            element.appendChild(textNode);
                          }
                        }

                        // Obtener la posición del nodo temporal
                        const tempRange = document.createRange();
                        tempRange.setStart(textNode, 0);
                        tempRange.setEnd(textNode, 1);

                        const tempRect = tempRange.getBoundingClientRect();
                        if (tempRect.width > 0 || tempRect.height > 0) {
                          indicatorX = tempRect.left;
                          indicatorTop = tempRect.top;
                          indicatorHeight = Math.max(tempRect.height, indicatorHeight);
                          foundValidPosition = true;
                        }

                        // Eliminar el nodo temporal
                        element.removeChild(textNode);
                      }
                    } catch (tempError) {
                    }
                  }
                }

                // Restaurar la selección anterior
                if (previousRange) {
                  selection.removeAllRanges();
                  selection.addRange(previousRange);
                } else {
                  selection.removeAllRanges();
                }
              }
            } catch (error) {
            }

            // Si aún no tenemos una posición válida, usar la coordenada X del mouse directamente
            if (!foundValidPosition) {
              // Usar la coordenada X del mouse, pero asegurarnos de que esté dentro del elemento
              const relativeY = y - elementRect.top;
              const lineNumber = Math.max(0, Math.floor(relativeY / lineHeight));
              const lineTop = elementRect.top + (lineNumber * lineHeight);

              // Usar la coordenada X del mouse directamente, limitada al ancho del elemento
              indicatorX = Math.max(elementRect.left + paddingLeft, Math.min(x, elementRect.right));
              indicatorTop = lineTop + (lineHeight - indicatorHeight) / 2;
            }

            // Asegurar que el indicador esté dentro del editor
            indicatorX = Math.max(editorRect.left, Math.min(indicatorX, editorRect.right));
            const finalIndicatorTop = Math.max(editorRect.top, Math.min(indicatorTop, editorRect.bottom - indicatorHeight));
            // Configurar el indicador
            indicator.style.left = `${indicatorX}px`;
            indicator.style.top = `${finalIndicatorTop}px`;
            indicator.style.height = `${indicatorHeight}px`;
            indicator.style.marginTop = '0px';
            indicator.style.marginBottom = '0px';
            indicator.style.display = 'block';
            indicator.style.visibility = 'visible';
            indicator.style.opacity = '1';
            return;
          }
        }

        // Encontrar el elemento padre que contiene el texto (puede ser P, DIV, etc.)
        let parentElement: Element | null = null;
        if (textNode.nodeType === Node.TEXT_NODE) {
          parentElement = textNode.parentElement;
        } else if (textNode.nodeType === Node.ELEMENT_NODE) {
          parentElement = textNode as Element;
        }

        if (!parentElement) {
          parentElement = editorElement;
        }

        // Obtener estilos del elemento padre para calcular altura de línea
        const computedStyle = window.getComputedStyle(parentElement);
        const parentLineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
        const parentRect = parentElement.getBoundingClientRect();

        // Calcular qué línea del párrafo es basándome en la posición Y del mouse
        const relativeY = y - parentRect.top;
        const lineNumber = Math.max(0, Math.floor(relativeY / parentLineHeight));
        const lineTop = parentRect.top + (lineNumber * parentLineHeight);

        // Calcular la posición X del indicador
        let indicatorX = x;

        // Si tenemos un nodo de texto, intentar obtener la posición precisa
        if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
          const textLength = textNode.textContent.length;
          let charRange: Range;
          let hasVisibleChar = false;

          // Crear un rango que incluya el carácter en la posición del offset
          // Manejar espacios en blanco y caracteres especiales
          if (offset < textLength) {
            // Intentar crear un rango con el carácter en la posición del offset
            charRange = document.createRange();
            charRange.setStart(textNode, offset);
            charRange.setEnd(textNode, Math.min(offset + 1, textLength));

            const charRect = charRange.getBoundingClientRect();

            const charAtOffset = textNode.textContent[offset];
            const isWhitespace = charAtOffset === ' ' || charAtOffset === '\t' || charAtOffset === '\n' || charAtOffset === '\r';

            // Si el carácter tiene ancho visible, usar su posición
            if (charRect.width > 0) {
              hasVisibleChar = true;
              indicatorX = charRect.left;
            } else {
              // Si es un espacio colapsado o carácter sin ancho, buscar el carácter visible más cercano
              // Primero intentar encontrar un carácter visible antes del offset
              let foundVisibleChar = false;

              // Buscar hacia atrás desde el offset
              for (let i = offset - 1; i >= 0; i--) {
                const testRange = document.createRange();
                testRange.setStart(textNode, i);
                testRange.setEnd(textNode, i + 1);
                const testRect = testRange.getBoundingClientRect();

                if (testRect.width > 0) {
                  const testChar = textNode.textContent[i];
                  const isTestWhitespace = testChar === ' ' || testChar === '\t' || testChar === '\n' || testChar === '\r';

                  if (!isTestWhitespace) {
                    // Encontramos un carácter visible no-espacio
                    indicatorX = testRect.right;
                    hasVisibleChar = true;
                    foundVisibleChar = true;
                    break;
                  } else if (isTestWhitespace && testRect.width > 0) {
                    // Encontramos un espacio visible
                    indicatorX = testRect.left;
                    hasVisibleChar = true;
                    foundVisibleChar = true;
                    break;
                  }
                }
              }

              // Si no encontramos hacia atrás, buscar hacia adelante
              if (!foundVisibleChar) {
                for (let i = offset + 1; i < textLength; i++) {
                  const testRange = document.createRange();
                  testRange.setStart(textNode, i);
                  testRange.setEnd(textNode, i + 1);
                  const testRect = testRange.getBoundingClientRect();

                  if (testRect.width > 0) {
                    const testChar = textNode.textContent[i];
                    const isTestWhitespace = testChar === ' ' || testChar === '\t' || testChar === '\n' || testChar === '\r';

                    if (!isTestWhitespace) {
                      // Encontramos un carácter visible no-espacio
                      indicatorX = testRect.left;
                      hasVisibleChar = true;
                      foundVisibleChar = true;
                      break;
                    } else if (isTestWhitespace && testRect.width > 0) {
                      // Encontramos un espacio visible
                      indicatorX = testRect.left;
                      hasVisibleChar = true;
                      foundVisibleChar = true;
                      break;
                    }
                  }
                }
              }

              // Si aún no encontramos un carácter visible, verificar si hay texto visible en el nodo
              if (!hasVisibleChar) {
                // Verificar si hay algún carácter visible en todo el nodo de texto
                let hasAnyVisibleChar = false;
                let visibleChars: Array<{ offset: number, char: string, width: number }> = [];

                for (let i = 0; i < textLength; i++) {
                  const testRange = document.createRange();
                  testRange.setStart(textNode, i);
                  testRange.setEnd(textNode, i + 1);
                  const testRect = testRange.getBoundingClientRect();

                  if (testRect.width > 0) {
                    hasAnyVisibleChar = true;
                    visibleChars.push({
                      offset: i,
                      char: textNode.textContent[i],
                      width: testRect.width
                    });
                  }
                }

                // Si no hay caracteres visibles en absoluto, ocultar el indicador
                if (!hasAnyVisibleChar) {
                  indicator.style.display = 'none';
                  return;
                }

                // Si hay caracteres visibles pero no en esta posición específica,
                // buscar el carácter visible más cercano en la misma línea Y
                let closestVisibleOffset = -1;
                let closestDistance = Infinity;

                for (let i = 0; i < textLength; i++) {
                  const testRange = document.createRange();
                  testRange.setStart(textNode, i);
                  testRange.setEnd(textNode, i + 1);
                  const testRect = testRange.getBoundingClientRect();

                  if (testRect.width > 0) {
                    // Verificar si está en la misma línea (misma Y aproximadamente)
                    const lineDiff = Math.abs(testRect.top - y);
                    if (lineDiff < parentLineHeight) {
                      const distance = Math.abs(testRect.left - x);
                      if (distance < closestDistance) {
                        closestDistance = distance;
                        closestVisibleOffset = i;
                      }
                    }
                  }
                }

                if (closestVisibleOffset >= 0) {
                  const closestRange = document.createRange();
                  closestRange.setStart(textNode, closestVisibleOffset);
                  closestRange.setEnd(textNode, closestVisibleOffset + 1);
                  const closestRect = closestRange.getBoundingClientRect();
                  indicatorX = closestRect.left;
                  hasVisibleChar = true;
                } else {
                  // No hay caracteres visibles en esta línea, ocultar el indicador
                  indicator.style.display = 'none';
                  return;
                }
              }
            }
          } else if (offset > 0 && offset === textLength) {
            // Si está al final del texto, usar el último carácter visible
            // Buscar el último carácter con ancho visible
            let lastVisibleOffset = -1;
            for (let i = textLength - 1; i >= 0; i--) {
              const testRange = document.createRange();
              testRange.setStart(textNode, i);
              testRange.setEnd(textNode, i + 1);
              const testRect = testRange.getBoundingClientRect();

              if (testRect.width > 0) {
                lastVisibleOffset = i;
                break;
              }
            }

            if (lastVisibleOffset >= 0) {
              charRange = document.createRange();
              charRange.setStart(textNode, lastVisibleOffset);
              charRange.setEnd(textNode, lastVisibleOffset + 1);
              const charRect = charRange.getBoundingClientRect();
              indicatorX = charRect.right || charRect.left;
              hasVisibleChar = true;
            } else {
              // No hay caracteres visibles, ocultar el indicador
              indicator.style.display = 'none';
              return;
            }
          } else {
            // Si está al inicio (offset === 0), buscar el primer carácter visible
            let firstVisibleOffset = -1;
            for (let i = 0; i < textLength; i++) {
              const testRange = document.createRange();
              testRange.setStart(textNode, i);
              testRange.setEnd(textNode, i + 1);
              const testRect = testRange.getBoundingClientRect();

              if (testRect.width > 0) {
                firstVisibleOffset = i;
                break;
              }
            }

            if (firstVisibleOffset >= 0) {
              charRange = document.createRange();
              charRange.setStart(textNode, firstVisibleOffset);
              charRange.setEnd(textNode, firstVisibleOffset + 1);
              const charRect = charRange.getBoundingClientRect();
              indicatorX = charRect.left;
              hasVisibleChar = true;
            } else {
              // No hay caracteres visibles, ocultar el indicador
              indicator.style.display = 'none';
              return;
            }
          }

          // Verificación final: si no hay caracteres visibles, ocultar el indicador
          if (!hasVisibleChar) {
            indicator.style.display = 'none';
            return;
          }
        } else {
          // Si no es un nodo de texto, ocultar el indicador (no hay caracteres visibles)
          indicator.style.display = 'none';
          return;
        }

        // Asegurar que el indicador esté dentro del editor
        indicatorX = Math.max(editorRect.left, Math.min(indicatorX, editorRect.right));

        // Asegurar que el indicador tenga una posición X válida
        // Si por alguna razón no tenemos una posición válida, usar la posición del mouse
        if (isNaN(indicatorX) || indicatorX < editorRect.left) {
          indicatorX = Math.max(editorRect.left, x);
        }

        // Calcular la altura del indicador basándose en el tamaño del carácter, no en toda la línea
        let indicatorHeight = 20; // Altura por defecto
        let indicatorTop = lineTop;

        // Si tenemos un nodo de texto, intentar obtener la altura del carácter
        if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
          const textLength = textNode.textContent.length;
          if (offset < textLength) {
            // Crear un rango con el carácter en la posición del offset
            const charRange = document.createRange();
            charRange.setStart(textNode, offset);
            charRange.setEnd(textNode, Math.min(offset + 1, textLength));
            const charRect = charRange.getBoundingClientRect();

            // Si el carácter tiene altura, usar esa altura
            if (charRect.height > 0) {
              indicatorHeight = charRect.height;
              indicatorTop = charRect.top;
            } else {
              // Si no tiene altura (espacio colapsado), usar el tamaño de fuente
              const fontSize = parseFloat(computedStyle.fontSize) || 16;
              indicatorHeight = fontSize * 1.2; // Altura de línea basada en fuente
              // Calcular el top basándose en la línea y el tamaño de fuente
              indicatorTop = lineTop + (parentLineHeight - indicatorHeight) / 2;
            }
          } else {
            // Si está al final, usar el tamaño de fuente
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            indicatorHeight = fontSize * 1.2;
            indicatorTop = lineTop + (parentLineHeight - indicatorHeight) / 2;
          }
        } else {
          // Si no es un nodo de texto, usar el tamaño de fuente del elemento padre
          const fontSize = parseFloat(computedStyle.fontSize) || 16;
          indicatorHeight = fontSize * 1.2;
          indicatorTop = lineTop + (parentLineHeight - indicatorHeight) / 2;
        }

        // Asegurar una altura mínima razonable pero no demasiado grande
        indicatorHeight = Math.max(Math.min(indicatorHeight, parentLineHeight), 16);

        // Asegurar que el indicador esté dentro del editor
        const finalIndicatorTop = Math.max(editorRect.top, Math.min(indicatorTop, editorRect.bottom - indicatorHeight));

        // Configurar el indicador
        indicator.style.left = `${indicatorX}px`;
        indicator.style.top = `${finalIndicatorTop}px`;
        indicator.style.height = `${indicatorHeight}px`;
        indicator.style.marginTop = '0px';
        indicator.style.marginBottom = '0px';
        indicator.style.display = 'block';
        indicator.style.visibility = 'visible';
        indicator.style.opacity = '1';
        return;
      }
    }

    // Si no se puede obtener el rango, intentar buscar texto visible cercano
    // Esto puede ocurrir cuando estamos sobre elementos vacíos o entre bloques
    try {
      // Buscar el elemento más cercano al punto del mouse dentro del editor
      const elementAtPoint = document.elementFromPoint(x, y);

      if (elementAtPoint && editorElement.contains(elementAtPoint)) {
        // Encontrar el elemento padre que es un bloque de Quill (P, DIV, etc.)
        let blockElement: Element | null = elementAtPoint;
        while (blockElement && blockElement !== editorElement) {
          const tagName = blockElement.tagName.toLowerCase();
          if (tagName === 'p' || tagName === 'div' || tagName === 'h1' || tagName === 'h2' ||
            tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6' ||
            tagName === 'li' || tagName === 'blockquote') {
            break;
          }
          blockElement = blockElement.parentElement;
        }

        if (!blockElement) {
          blockElement = editorElement;
        }

        // Buscar nodos de texto con contenido visible dentro del bloque
        const walker = document.createTreeWalker(
          blockElement,
          NodeFilter.SHOW_TEXT,
          null
        );

        let closestTextNode: Text | null = null;
        let closestDistance = Infinity;
        let closestCharOffset = 0;
        let fallbackTextNodes: Array<{ node: Text, content: string }> = [];

        // Buscar el nodo de texto más cercano al punto del mouse
        let node: Node | null;
        while (node = walker.nextNode()) {
          const textNodeCandidate = node as Text;
          const textContent = textNodeCandidate.textContent || '';

          fallbackTextNodes.push({ node: textNodeCandidate, content: textContent });

          // MODIFICADO: Considerar nodos con cualquier contenido, incluyendo solo espacios
          // Verificar si el nodo tiene contenido (no solo espacios colapsados)
          if (textContent.length === 0) {
            continue;
          }

          // Buscar el carácter más cercano dentro de este nodo de texto
          for (let i = 0; i <= textContent.length; i++) {
            const tempRange = document.createRange();
            tempRange.setStart(textNodeCandidate, i);
            tempRange.setEnd(textNodeCandidate, i);
            const charRect = tempRange.getBoundingClientRect();

            const char = i < textContent.length ? textContent[i] : '(end)';
            const isWhitespace = char === ' ' || char === '\t' || char === '\n' || char === '\r';

            // Solo considerar posiciones con ancho visible o en los extremos
            if (charRect.width > 0 || i === 0 || i === textContent.length) {
              const charCenterX = charRect.width > 0
                ? charRect.left + charRect.width / 2
                : charRect.left;
              const charCenterY = charRect.height > 0
                ? charRect.top + charRect.height / 2
                : charRect.top;

              const distance = Math.sqrt(
                Math.pow(x - charCenterX, 2) + Math.pow(y - charCenterY, 2)
              );
              if (distance < closestDistance) {
                closestDistance = distance;
                closestTextNode = textNodeCandidate;
                closestCharOffset = i;
              }
            }
          }
        }

        // Si encontramos un nodo de texto cercano con contenido visible, usar su posición
        if (closestTextNode && closestTextNode.textContent) {
          const textLength = closestTextNode.textContent.length;
          const charRange = document.createRange();

          if (closestCharOffset < textLength) {
            charRange.setStart(closestTextNode, closestCharOffset);
            charRange.setEnd(closestTextNode, Math.min(closestCharOffset + 1, textLength));
          } else {
            charRange.setStart(closestTextNode, Math.max(0, textLength - 1));
            charRange.setEnd(closestTextNode, textLength);
          }

          const charRect = charRange.getBoundingClientRect();
          if (charRect.width > 0) {
            const computedStyle = window.getComputedStyle(closestTextNode.parentElement || blockElement);
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;

            const indicatorHeight = Math.max(Math.min(fontSize * 1.2, lineHeight), 16);
            const indicatorTop = charRect.top + (charRect.height - indicatorHeight) / 2;
            const indicatorX = charRect.left;
            // Configurar el indicador
            indicator.style.left = `${indicatorX}px`;
            indicator.style.top = `${indicatorTop}px`;
            indicator.style.height = `${indicatorHeight}px`;
            indicator.style.marginTop = '0px';
            indicator.style.marginBottom = '0px';
            indicator.style.display = 'block';
            indicator.style.visibility = 'visible';
            indicator.style.opacity = '1';
            return;
          }
        } else {
          // Si no hay nodos de texto, obtener la posición del cursor nativo usando caretRangeFromPoint
          const blockRect = blockElement.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(blockElement);
          const fontSize = parseFloat(computedStyle.fontSize) || 16;
          const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
          const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;

          let indicatorX = blockRect.left + paddingLeft;
          let indicatorTop = blockRect.top;
          let indicatorHeight = Math.max(Math.min(fontSize * 1.2, lineHeight), 16);

          // Intentar obtener la posición del cursor nativo usando caretRangeFromPoint
          let foundValidPosition = false;
          try {
            const nativeRange = (document as any).caretRangeFromPoint?.(x, y);

            if (nativeRange && nativeRange.setStart) {
              // Si es un Range, obtener su posición
              const nativeRect = nativeRange.getBoundingClientRect();
              if (nativeRect.width > 0 && nativeRect.height > 0) {
                indicatorX = nativeRect.left;
                indicatorTop = nativeRect.top;
                indicatorHeight = Math.max(nativeRect.height, indicatorHeight);
                foundValidPosition = true;
              }

              // También intentar usar la selección temporal y getClientRects
              const selection = window.getSelection();
              if (selection && !foundValidPosition) {
                const previousRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
                selection.removeAllRanges();
                selection.addRange(nativeRange);

                if (selection.rangeCount > 0) {
                  const selectionRange = selection.getRangeAt(0);
                  const clientRects = selectionRange.getClientRects();
                  if (clientRects.length > 0 && clientRects[0].width > 0 && clientRects[0].height > 0) {
                    const firstRect = clientRects[0];
                    indicatorX = firstRect.left;
                    indicatorTop = firstRect.top;
                    indicatorHeight = Math.max(firstRect.height, indicatorHeight);
                    foundValidPosition = true;
                  }

                  // Si aún no encontramos una posición válida, intentar insertar un carácter temporal
                  if (!foundValidPosition && selectionRange.startContainer) {
                    try {
                      const tempChar = '\u200B'; // Zero-width space
                      const textNode = selectionRange.startContainer.nodeType === Node.TEXT_NODE
                        ? selectionRange.startContainer as Text
                        : null;

                      if (textNode) {
                        // Si es un nodo de texto, insertar el carácter temporal
                        const originalText = textNode.textContent || '';
                        const offset = selectionRange.startOffset;
                        textNode.textContent = originalText.slice(0, offset) + tempChar + originalText.slice(offset);

                        // Crear un nuevo range para el carácter temporal
                        const tempRange = document.createRange();
                        tempRange.setStart(textNode, offset);
                        tempRange.setEnd(textNode, offset + 1);

                        // Obtener la posición del carácter temporal
                        const tempRect = tempRange.getBoundingClientRect();
                        if (tempRect.width > 0 || tempRect.height > 0) {
                          indicatorX = tempRect.left;
                          indicatorTop = tempRect.top;
                          indicatorHeight = Math.max(tempRect.height, indicatorHeight);
                          foundValidPosition = true;
                        }

                        // Restaurar el texto original
                        textNode.textContent = originalText;
                      } else if (selectionRange.startContainer.nodeType === Node.ELEMENT_NODE) {
                        // Si es un elemento, crear un nodo de texto temporal
                        const element = selectionRange.startContainer as Element;
                        const textNode = document.createTextNode(tempChar);
                        const offset = selectionRange.startOffset;

                        if (offset === 0) {
                          element.insertBefore(textNode, element.firstChild);
                        } else {
                          const childNodes = Array.from(element.childNodes);
                          if (offset < childNodes.length) {
                            element.insertBefore(textNode, childNodes[offset]);
                          } else {
                            element.appendChild(textNode);
                          }
                        }

                        // Obtener la posición del nodo temporal
                        const tempRange = document.createRange();
                        tempRange.setStart(textNode, 0);
                        tempRange.setEnd(textNode, 1);

                        const tempRect = tempRange.getBoundingClientRect();
                        if (tempRect.width > 0 || tempRect.height > 0) {
                          indicatorX = tempRect.left;
                          indicatorTop = tempRect.top;
                          indicatorHeight = Math.max(tempRect.height, indicatorHeight);
                          foundValidPosition = true;
                        }

                        // Eliminar el nodo temporal
                        element.removeChild(textNode);
                      }
                    } catch (tempError) {
                    }
                  }
                }

                if (previousRange) {
                  selection.removeAllRanges();
                  selection.addRange(previousRange);
                } else {
                  selection.removeAllRanges();
                }
              }
            }
          } catch (error) {
          }

          // Si aún no tenemos una posición válida, usar la coordenada X del mouse directamente
          if (!foundValidPosition) {
            const relativeY = y - blockRect.top;
            const lineNumber = Math.max(0, Math.floor(relativeY / lineHeight));
            const lineTop = blockRect.top + (lineNumber * lineHeight);

            // Usar la coordenada X del mouse directamente, limitada al ancho del elemento
            indicatorX = Math.max(blockRect.left + paddingLeft, Math.min(x, blockRect.right));
            indicatorTop = lineTop + (lineHeight - indicatorHeight) / 2;
          }

          // Asegurar que el indicador esté dentro del editor
          indicatorX = Math.max(editorRect.left, Math.min(indicatorX, editorRect.right));
          const finalIndicatorTop = Math.max(editorRect.top, Math.min(indicatorTop, editorRect.bottom - indicatorHeight));
          // Configurar el indicador
          indicator.style.left = `${indicatorX}px`;
          indicator.style.top = `${finalIndicatorTop}px`;
          indicator.style.height = `${indicatorHeight}px`;
          indicator.style.marginTop = '0px';
          indicator.style.marginBottom = '0px';
          indicator.style.display = 'block';
          indicator.style.visibility = 'visible';
          indicator.style.opacity = '1';
          return;
        }
      }
    } catch (error) {
    }

    // Si todo falla, ocultar el indicador
    indicator.style.display = 'none';
  } catch (error) {
    // En caso de error, ocultar el indicador
    indicator.style.display = 'none';
  }
}
