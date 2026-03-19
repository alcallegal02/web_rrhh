/**
 * Utilidades para manejo de subida de imágenes
 */

export interface ImageUploadConfig {
  maxSizeBytes: number;
  allowedTypes: string[];
}

export const DEFAULT_IMAGE_UPLOAD_CONFIG: ImageUploadConfig = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/']
};

/**
 * Valida un archivo de imagen
 */
export function validateImageFile(
  file: File,
  config: ImageUploadConfig = DEFAULT_IMAGE_UPLOAD_CONFIG
): { valid: boolean; error?: string } {
  // Validar tipo de archivo
  const isValidType = config.allowedTypes.some(type => file.type.startsWith(type));
  if (!isValidType) {
    return { valid: false, error: 'Por favor, selecciona solo archivos de imagen' };
  }
  
  // Validar tamaño
  if (file.size > config.maxSizeBytes) {
    const maxSizeMB = Math.round(config.maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `La imagen es demasiado grande. Máximo ${maxSizeMB}MB` };
  }
  
  return { valid: true };
}

/**
 * Normaliza una URL de imagen asegurando que comience con /
 */
export function normalizeImageUrl(url: string): string {
  return url.startsWith('/') ? url : '/' + url;
}

/**
 * Calcula un índice seguro para insertar en Quill
 */
export function calculateSafeInsertIndex(quill: any, preferredIndex?: number): number {
  const length = quill.getLength();
  
  if (preferredIndex !== undefined && preferredIndex >= 0) {
    return Math.max(0, Math.min(preferredIndex, Math.max(0, length - 1)));
  }
  
  return Math.max(0, length - 1);
}

