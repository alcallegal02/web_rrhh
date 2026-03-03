import { Injectable } from '@angular/core';
import { applyImageStyles, buildImageStyle } from '../utils/image-utils';

/**
 * Interfaz para los estilos guardados de una imagen
 */
export interface ImageStyle {
  width: string;
  height: string;
  style: string;
}

/**
 * Servicio para gestionar los estilos de las imágenes en el editor
 * Utiliza el src de la imagen como clave para persistir los estilos
 * incluso cuando Quill recrea el DOM
 */
@Injectable({
  providedIn: 'root'
})
export class ImageStyleManager {
  private savedImageStyles: Map<string, ImageStyle> = new Map();

  /**
   * Guarda los estilos de una imagen
   */
  saveStyle(imageSrc: string, style: ImageStyle): void {
    this.savedImageStyles.set(imageSrc, style);
  }

  /**
   * Obtiene los estilos guardados de una imagen
   */
  getStyle(imageSrc: string): ImageStyle | undefined {
    return this.savedImageStyles.get(imageSrc);
  }

  /**
   * Obtiene los estilos guardados de una imagen HTML
   */
  getStyleFromElement(el: HTMLElement): ImageStyle | undefined {
    return this.savedImageStyles.get((el as any).src);
  }

  /**
   * Elimina los estilos guardados de una imagen
   */
  removeStyle(imageSrc: string): void {
    this.savedImageStyles.delete(imageSrc);
  }

  /**
   * Obtiene todos los estilos guardados
   */
  getAllStyles(): Map<string, ImageStyle> {
    return this.savedImageStyles;
  }

  /**
   * Limpia todos los estilos guardados
   */
  clearAll(): void {
    this.savedImageStyles.clear();
  }

  /**
   * Construye un estilo completo a partir de width y height
   * @deprecated Use buildImageStyle from image-style-utils instead
   */
  buildStyle(width: string, height: string, existingStyle?: string): string {
    return buildImageStyle(width, height, existingStyle);
  }

  /**
   * Aplica estilos a una imagen y su blot de Quill
   */
  applyStyleToElement(
    el: HTMLElement,
    style: ImageStyle,
    quillInstance?: any
  ): void {
    applyImageStyles(el, style.style, style.width, style.height, quillInstance);
  }
}
