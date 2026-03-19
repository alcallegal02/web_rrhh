/**
 * Utilidades consolidadas de helpers generales
 * Incluye: async, errores y estados
 */

// ============================================================================
// OPERACIONES ASÍNCRONAS
// ============================================================================

export class RAFThrottle {
  private rafId: number | null = null;

  execute(callback: () => void): void {
    if (this.rafId !== null) {
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      callback();
    });
  }

  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function executeAfterDelay(callback: () => void, ms: number): () => void {
  const timeoutId = setTimeout(callback, ms);
  return () => clearTimeout(timeoutId);
}

export function executeNextFrame(callback: () => void): void {
  requestAnimationFrame(callback);
}

// ============================================================================
// MANEJO DE ERRORES
// ============================================================================

export interface ErrorInfo {
  message: string;
  detail?: string;
  code?: string;
}

export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.error?.detail) {
    return error.error.detail;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'Ha ocurrido un error desconocido';
}

export function createErrorInfo(error: any, defaultMessage: string = 'Ha ocurrido un error'): ErrorInfo {
  return {
    message: extractErrorMessage(error) || defaultMessage,
    detail: error?.error?.detail || error?.detail,
    code: error?.code || error?.error?.code
  };
}

export function handleError(error: any, defaultMessage: string = 'Ha ocurrido un error'): ErrorInfo {
  return createErrorInfo(error, defaultMessage);
}

// ============================================================================
// ESTADOS DE RESIZE
// ============================================================================

export function isResizeOperationActive(
  isResizing: boolean,
  isUpdatingImageSize: boolean
): boolean {
  return isResizing || isUpdatingImageSize;
}

export function canProcessOperation(
  isResizing: boolean,
  isUpdatingImageSize: boolean
): boolean {
  return !isResizeOperationActive(isResizing, isUpdatingImageSize);
}
