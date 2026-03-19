/**
 * Factory para crear handles de redimensionamiento
 */

import { HANDLE_POSITIONS, HANDLE_CURSORS, RESIZE_HANDLE_CLASS, HANDLE_BORDER_COLOR } from './constants';
import { createElement } from './dom-utils';

export interface HandleConfig {
  position: string;
  onMouseDown: (e: MouseEvent) => void;
}

/**
 * Crea un handle individual de redimensionamiento
 */
export function createResizeHandle(config: HandleConfig): HTMLElement {
  const handle = createElement('div', `${RESIZE_HANDLE_CLASS} ${config.position}`, {
    cursor: HANDLE_CURSORS[config.position] || 'default'
  });
  
  handle.addEventListener('mousedown', (e: Event) => {
    const mouseEvent = e as MouseEvent;
    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    config.onMouseDown(mouseEvent);
  });
  
  return handle;
}

/**
 * Crea el contenedor de handles con su estilo
 */
export function createResizeHandlesContainer(editorContainer: HTMLElement): HTMLElement {
  const container = createElement('div', 'image-resize-handles', {
    position: 'absolute',
    border: `2px solid ${HANDLE_BORDER_COLOR}`,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: '2',
    top: '0',
    left: '0'
  });
  
  // Añadir al contenedor del editor en lugar del body
  editorContainer.appendChild(container);
  return container;
}

/**
 * Crea todos los handles de redimensionamiento
 */
export function createAllResizeHandles(
  onHandleMouseDown: (handle: HTMLElement, e: MouseEvent) => void
): HTMLElement[] {
  return HANDLE_POSITIONS.map(position => {
    return createResizeHandle({
      position,
      onMouseDown: (e: MouseEvent) => {
        const handle = e.target as HTMLElement;
        onHandleMouseDown(handle, e);
      }
    });
  });
}

