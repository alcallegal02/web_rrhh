/**
 * Utilidades para cálculo de redimensionamiento de imágenes
 */

import { DEFAULT_MIN_SIZE } from './constants';

export interface ResizeParams {
  handle: string;
  deltaX: number;
  deltaY: number;
  startWidth: number;
  startHeight: number;
  startAspectRatio: number;
  minSize?: number;
}

export interface ResizeResult {
  width: number;
  height: number;
}

const CORNER_HANDLES = ['nw', 'ne', 'sw', 'se'] as const;

/**
 * Calcula las nuevas dimensiones basándose en el handle y el movimiento del mouse
 */
export function calculateResizeDimensions(params: ResizeParams): ResizeResult {
  const { handle, deltaX, deltaY, startWidth, startHeight, minSize = DEFAULT_MIN_SIZE } = params;
  
  const isCorner = CORNER_HANDLES.includes(handle as any);
  let newWidth = startWidth;
  let newHeight = startHeight;

  if (isCorner) {
    // Redimensionamiento proporcional desde esquinas
    const widthChange = handle.includes('e') ? deltaX : handle.includes('w') ? -deltaX : 0;
    const heightChange = handle.includes('s') ? deltaY : handle.includes('n') ? -deltaY : 0;

    const scaleX = (startWidth + widthChange) / startWidth;
    const scaleY = (startHeight + heightChange) / startHeight;
    const scale = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;

    newWidth = startWidth * scale;
    newHeight = startHeight * scale;
  } else {
    // Redimensionamiento desde lados
    if (handle === 'e' || handle === 'w') {
      newWidth = startWidth + (handle === 'e' ? deltaX : -deltaX);
    } else if (handle === 's' || handle === 'n') {
      newHeight = startHeight + (handle === 's' ? deltaY : -deltaY);
    }
  }

  // Aplicar límites mínimos
  return {
    width: Math.max(newWidth, minSize),
    height: Math.max(newHeight, minSize)
  };
}

/**
 * Formatea un valor numérico como string de CSS (con 'px' si es necesario)
 */
export function formatDimension(value: number | string): string {
  return typeof value === 'string' ? value : `${value}px`;
}
