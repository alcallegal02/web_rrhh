/**
 * Utilidades consolidadas para manipulación del DOM
 * Incluye: elementos, clases, estilos, posición y validación
 */

// ============================================================================
// MANIPULACIÓN DE ELEMENTOS
// ============================================================================

export function isElementContained(child: Node | null, parent: HTMLElement): boolean {
  return child !== null && parent.contains(child);
}

export function isInDOM(element: HTMLElement | null): boolean {
  return element !== null && document.body.contains(element);
}

export function createElement(
  tag: string,
  className?: string,
  styles?: Partial<CSSStyleDeclaration>
): HTMLElement {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (styles) {
    Object.assign(element.style, styles);
  }

  return element;
}

export function getAllResizableElements(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll('img, iframe, div.image-resizable, div.ql-video-wrapper')) as HTMLElement[];
}

export function isResizeHandle(element: HTMLElement): boolean {
  return element.classList.contains('image-resize-handle') ||
    !!element.closest('.image-resize-handle');
}

export function isResizeHandles(element: HTMLElement): boolean {
  return element.classList.contains('image-resize-handles') ||
    !!element.closest('.image-resize-handles');
}

// ============================================================================
// MANIPULACIÓN DE CLASES
// ============================================================================

export function addClasses(element: HTMLElement, ...classes: string[]): void {
  element.classList.add(...classes.filter(Boolean));
}

export function removeClasses(element: HTMLElement, ...classes: string[]): void {
  element.classList.remove(...classes.filter(Boolean));
}

// ============================================================================
// MANIPULACIÓN DE ESTILOS
// ============================================================================

export function applyStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>
): void {
  Object.assign(element.style, styles);
}

export function getStyle(element: HTMLElement, property: string): string {
  return element.style.getPropertyValue(property) || '';
}

export function setStyle(element: HTMLElement, property: string, value: string): void {
  element.style.setProperty(property, value);
}

export function removeStyle(element: HTMLElement, property: string): void {
  element.style.removeProperty(property);
}

export function disableUserSelect(element: HTMLElement): void {
  setStyle(element, 'user-select', 'none');
}

export function enableUserSelect(element: HTMLElement): void {
  removeStyle(element, 'user-select');
}

export function setDocumentCursor(cursor: string): void {
  document.body.style.cursor = cursor;
}

export function resetDocumentCursor(): void {
  document.body.style.cursor = '';
}

// ============================================================================
// CÁLCULOS DE POSICIÓN
// ============================================================================

export function applyRectToElement(
  element: HTMLElement,
  rect: DOMRect
): void {
  element.style.top = `${rect.top}px`;
  element.style.left = `${rect.left}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

export function getRectCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function getDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// VALIDACIONES
// ============================================================================

export function isNullOrUndefined<T>(value: T | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

export function exists<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isValidQuillIndex(index: number | null | undefined): index is number {
  return exists(index) && index >= 0;
}

export function hasValidImageStyle(style: { width?: string; height?: string } | null | undefined): boolean {
  return exists(style) && !!style.width && !!style.height;
}

export function isValidResizableElement(element: Element | null): element is HTMLElement {
  return element !== null && (
    element.tagName === 'IMG' ||
    element.tagName === 'IFRAME' ||
    (element.tagName === 'DIV' && (element.classList.contains('image-resizable') || element.classList.contains('ql-video-wrapper')))
  );
}
