/**
 * Constantes utilizadas en el editor de texto enriquecido
 */

export const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const;

export const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  w: 'w-resize',
  e: 'e-resize',
  sw: 'sw-resize',
  s: 's-resize',
  se: 'se-resize'
};

export const RESIZE_HANDLE_CLASS = 'image-resize-handle';
export const RESIZE_HANDLES_CLASS = 'image-resize-handles';
export const IMAGE_RESIZABLE_CLASS = 'image-resizable';
export const DRAGGING_IMAGE_CLASS = 'dragging-image';
export const DROP_INDICATOR_CLASS = 'image-drop-indicator';

// Tamaños y dimensiones
export const DEFAULT_MIN_SIZE = 50;
export const DEFAULT_IMAGE_SIZE = 200;
export const HANDLE_SIZE = 8;
export const HANDLE_BORDER_SIZE = 2;
export const HANDLE_OFFSET = -(HANDLE_SIZE / 2 + HANDLE_BORDER_SIZE);

// Delays y timeouts
export const STYLE_UPDATE_DELAY = 100;
export const IMAGE_SELECTION_DELAY = 50;

// Estilos CSS
export const MAX_WIDTH_NONE = 'max-width: none';
export const MAX_HEIGHT_NONE = 'max-height: none';
export const USER_SELECT_NONE = 'user-select: none';

// Colores
export const HANDLE_BORDER_COLOR = '#3b82f6';
export const DROP_INDICATOR_COLOR = '#4285f4';

// Tolerancia para comparación de dimensiones
export const DIMENSION_TOLERANCE = 1;

