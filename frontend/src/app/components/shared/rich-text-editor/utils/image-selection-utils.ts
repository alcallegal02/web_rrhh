/**
 * Utilidades consolidadas para selección de imágenes
 * Incluye: gestión de selección, preservación, handles y utilidades
 */

import { IMAGE_RESIZABLE_CLASS } from './constants';
import { addClasses, removeClasses, getAllResizableElements, isInDOM } from './dom-utils';
import { findResizableElementBySrc } from './quill-utils';
import { createResizeHandlesContainer, createAllResizeHandles } from './resize-handle-factory';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ElementSelectionRestoreCallback {
  (element: HTMLElement): void;
}

export interface HandleCreationCallback {
  (handle: HTMLElement, e: MouseEvent): void;
}

export interface RestoreElementSelectionResult {
  element: HTMLElement | null;
  handles: HTMLElement | null;
}

// ============================================================================
// GESTIÓN DE SELECCIÓN
// ============================================================================

export function markElementAsResizable(el: HTMLElement): void {
  addClasses(el, IMAGE_RESIZABLE_CLASS);
  el.setAttribute('draggable', 'true');
}

export function unmarkElementAsResizable(el: HTMLElement): void {
  removeClasses(el, IMAGE_RESIZABLE_CLASS);
}

export function markAllElementsAsResizable(container: HTMLElement): void {
  const elements = getAllResizableElements(container);
  elements.forEach((el) => {
    markElementAsResizable(el);
  });
}

export function isElementResizable(el: HTMLElement): boolean {
  return el.classList.contains(IMAGE_RESIZABLE_CLASS);
}

export function findResizableElements(container: HTMLElement): HTMLElement[] {
  return getAllResizableElements(container).filter(isElementResizable);
}

// ============================================================================
// ELIMINACIÓN DE SELECCIÓN
// ============================================================================

export function removeImageSelection(border: HTMLElement | null, handles: HTMLElement | null): void {
  if (border && isInDOM(border)) {
    border.remove();
  }
  if (handles && isInDOM(handles)) {
    handles.remove();
  }
}

// ============================================================================
// PRESERVACIÓN DE SELECCIÓN
// ============================================================================

export function preserveElementSelectionAfterQuillUpdate(
  elementRef: HTMLElement,
  elementSrc: string,
  editorElement: HTMLElement,
  onRestore?: ElementSelectionRestoreCallback
): HTMLElement | null {
  if (editorElement.contains(elementRef) && (elementRef as any).src === elementSrc) {
    markElementAsResizable(elementRef);
    onRestore?.(elementRef);
    return elementRef;
  }

  const foundElement = findResizableElementBySrc(editorElement, elementSrc);
  if (foundElement) {
    markElementAsResizable(foundElement);
    onRestore?.(foundElement);
    return foundElement;
  }

  return null;
}

// ============================================================================
// GESTIÓN DE HANDLES
// ============================================================================

export function ensureHandlesVisible(
  resizeHandles: HTMLElement | null,
  selectedElement: HTMLElement | null,
  editorElement: HTMLElement,
  elementSrc: string,
  onHandleMouseDown: HandleCreationCallback
): HTMLElement | null {
  let element = selectedElement;
  if (!element) {
    element = findResizableElementBySrc(editorElement, elementSrc);
    if (!element) {
      return null;
    }
  }

  const editorContainer = editorElement.closest('.ql-container') as HTMLElement | null ||
    editorElement.parentElement ||
    editorElement;

  if (!resizeHandles || !isInDOM(resizeHandles)) {
    if (resizeHandles) {
      resizeHandles.remove();
    }

    const container = createResizeHandlesContainer(editorContainer);
    const handles = createAllResizeHandles(onHandleMouseDown);

    handles.forEach(handle => {
      container.appendChild(handle);
    });

    return container;
  }

  return resizeHandles;
}

export function restoreElementSelection(
  elementRef: HTMLElement | null,
  elementSrc: string,
  editorElement: HTMLElement
): HTMLElement | null {
  if (elementRef && editorElement.contains(elementRef) && (elementRef as any).src === elementSrc) {
    markElementAsResizable(elementRef);
    return elementRef;
  }

  const foundElement = findResizableElementBySrc(editorElement, elementSrc);
  if (foundElement) {
    markElementAsResizable(foundElement);
    return foundElement;
  }

  return null;
}

export function restoreCompleteElementSelection(
  elementRef: HTMLElement | null,
  elementSrc: string,
  editorElement: HTMLElement,
  resizeHandles: HTMLElement | null,
  onHandleMouseDown: HandleCreationCallback
): RestoreElementSelectionResult {
  const element = restoreElementSelection(elementRef, elementSrc, editorElement);

  if (!element) {
    return { element: null, handles: null };
  }

  const handles = ensureHandlesVisible(resizeHandles, element, editorElement, elementSrc, onHandleMouseDown);

  return { element, handles };
}
