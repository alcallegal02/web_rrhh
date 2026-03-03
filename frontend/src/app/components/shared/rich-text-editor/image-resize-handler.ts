import { ImageStyleManager, ImageStyle } from './services/image-style-manager.service';
import {
  applyImageStyles,
  getImageDimensions,
  applyResizeStyles,
  getCurrentImageDimensions,
  normalizeDimension,
  buildImageStyle,
  applyStylesToAllImagesWithSrc,
  restoreStylesAfterQuillUpdate
} from './utils/image-utils';
import { calculateResizeDimensions, formatDimension } from './utils/image-resize-utils';
import {
  getElementIndexInQuill,
  findResizableElementBySrc,
  getQuillIndexFromPoint,
  isPointInRect,
  moveImageInQuill
} from './utils/quill-utils';
import { EventListenerManager } from './utils/event-listener-manager';
import { MutationObserverManager } from './utils/mutation-observer-manager';
import {
  HANDLE_POSITIONS,
  HANDLE_CURSORS,
  IMAGE_RESIZABLE_CLASS,
  DRAGGING_IMAGE_CLASS,
  RESIZE_HANDLES_CLASS,
  STYLE_UPDATE_DELAY,
  IMAGE_SELECTION_DELAY
} from './utils/constants';
import {
  isResizeHandle,
  isResizeHandles,
  isInDOM,
  isElementContained,
  disableUserSelect,
  enableUserSelect,
  setDocumentCursor,
  resetDocumentCursor,
  isValidQuillIndex,
  hasValidImageStyle,
  getAllResizableElements,
  isValidResizableElement,
  addClasses,
  removeClasses,
  getRectCenter
} from './utils/dom-utils';
import {
  markElementAsResizable,
  unmarkElementAsResizable,
  findResizableElements,
  removeImageSelection,
  preserveElementSelectionAfterQuillUpdate,
  ensureHandlesVisible,
  restoreCompleteElementSelection
} from './utils/image-selection-utils';
import {
  prepareImageForDrag,
  finalizeImageDrag,
  calculateAdjustedIndex,
  preventDragDefault,
  isDragInsideEditor,
  getDragCoordinates,
  createDropIndicator,
  updateDropIndicatorPosition
} from './utils/drag-drop-utils';
import { RAFThrottle, executeAfterDelay, isResizeOperationActive } from './utils/helpers';


/**
 * Clase que maneja el redimensionamiento visual de imÃ¡genes en el editor
 * Similar al comportamiento de Microsoft Word o Google Docs
 */
export class ImageResizeHandler {
  private editorElement: HTMLElement;
  private containerElement: HTMLElement;
  private quillInstance: any;
  private selectedElement: HTMLElement | null = null;
  private resizeHandles: HTMLElement | null = null;
  private isResizing: boolean = false;
  private isRestoringSelection: boolean = false;
  private isApplyingFormat: boolean = false;
  private resizeHandle: string = '';
  private startX: number = 0;
  private startY: number = 0;
  private startWidth: number = 0;
  private startHeight: number = 0;
  private startAspectRatio: number = 0;
  private dropIndicator: HTMLElement | null = null;
  private isReconnectingIndicator: boolean = false;
  private lastDropPosition: { x: number; y: number; index: number | null } | null = null;
  private originalElementIndex: number | null = null; // Índice original de la imagen al inicio del drag
  private originalElementDimensions: { width: string; height: string; style: string; naturalWidth: number; naturalHeight: number } | null = null; // Dimensiones originales de la imagen al inicio del drag
  private onElementUpdate: () => void;
  private styleManager: ImageStyleManager;
  private isUpdatingElementSize: boolean = false;
  private isNativeDragActive: boolean = false;
  private isUpdatingHandlesPosition: boolean = false;
  private handlesPositionThrottle: RAFThrottle = new RAFThrottle();
  private eventManager: EventListenerManager = new EventListenerManager();
  private observerManager: MutationObserverManager = new MutationObserverManager();
  private lastDragEndTime: number = 0; // Timestamp del último drag para evitar condiciones de carrera

  // Handlers para Quill (necesitan referencia para cleanup)
  private quillTextChangeHandler: ((delta: any, oldDelta: any, source: string) => void) | null = null;
  private quillSelectionChangeHandler: (() => void) | null = null;

  constructor(
    editorElement: HTMLElement,
    quillInstance: any,
    onElementUpdate: () => void,
    styleManager?: ImageStyleManager
  ) {
    this.editorElement = editorElement;
    const container = editorElement.closest('.ql-container') as HTMLElement | null;
    this.containerElement = container || editorElement.parentElement || editorElement;
    this.quillInstance = quillInstance;
    this.onElementUpdate = onElementUpdate;
    this.styleManager = styleManager || new ImageStyleManager();
    this.injectHideCursorStyles();
    this.setupEventListeners();
    this.setupQuillListeners();
    this.setupQuillListeners();
    // Verificar elementos existentes
    const existingElements = editorElement.querySelectorAll('img, iframe');
    existingElements.forEach((el, index) => {
      // Los elementos se procesarán cuando se seleccionen
    });
  }

  /**
   * Inyecta estilos CSS para ocultar el cursor nativo durante el drag
   */
  private injectHideCursorStyles(): void {
    // Verificar si los estilos ya están inyectados
    if (document.getElementById('hide-native-cursor-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'hide-native-cursor-styles';
    style.textContent = `
      .ql-editor.hide-native-cursor {
        caret-color: transparent !important;
      }
      .ql-editor.hide-native-cursor * {
        caret-color: transparent !important;
      }
      .ql-editor.hide-native-cursor::selection {
        background: transparent !important;
      }
      .ql-editor.hide-native-cursor *::selection {
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Método público para obtener el elemento seleccionado
   */
  getSelectedImage(): HTMLElement | null {
    return this.selectedElement;
  }

  /**
   * Método público para seleccionar un elemento (útil para restaurar selección después de cambios)
   */
  selectElementPublic(el: HTMLElement, forceUpdate: boolean = false): void {
    this.selectElement(el, forceUpdate);
  }

  /**
   * Marca que se está aplicando formato para evitar deselección
   */
  setApplyingFormat(value: boolean): void {
    this.isApplyingFormat = value;
  }

  /**
   * Verifica si actualmente se está redimensionando una imagen
   */
  isCurrentlyResizing(): boolean {
    return this.isResizing || this.isUpdatingElementSize;
  }

  /**
   * Método público para obtener los estilos guardados de un elemento
   */
  getSavedImageStyle(el: HTMLElement): ImageStyle | undefined {
    return this.styleManager.getStyleFromElement(el as any);
  }

  /**
   * MÃ©todo pÃºblico para obtener todos los estilos guardados
   */
  getAllSavedImageStyles(): Map<string, ImageStyle> {
    return this.styleManager.getAllStyles();
  }

  private setupQuillListeners(): void {
    // Escuchar cambios de contenido de Quill
    this.quillTextChangeHandler = (delta: any, oldDelta: any, source: string) => {
      // Ignorar cambios durante el resize o actualización de tamaño
      if (isResizeOperationActive(this.isResizing, this.isUpdatingElementSize)) {
        return;
      }

      // Solo procesar cambios de texto si realmente hay un elemento seleccionado
      // Y verificar que el usuario no está escribiendo texto (la selección no está en el elemento)
      if (source === 'user' && this.selectedElement) {
        const selection = this.quillInstance.getSelection(false);
        const elementIndex = getElementIndexInQuill(this.quillInstance, this.editorElement, this.selectedElement);

        // Si la selección existe y NO está en el elemento (incluso si length es 0, es un cursor), el usuario está escribiendo
        const isWritingText = selection &&
          elementIndex !== null &&
          selection.index !== elementIndex;

        // Si el usuario está escribiendo texto, NO llamar handleQuillTextChange
        // Esto previene que se restaure la selección del elemento cuando el usuario escribe
        if (isWritingText) {
          // Usuario está escribiendo texto, solo actualizar posición de handles si es necesario
          if (this.resizeHandles && this.selectedElement.isConnected) {
            this.updateHandlesPosition();
          }
          return;
        }

        this.handleQuillTextChange();
      }
    };

    this.quillInstance.on('text-change', this.quillTextChangeHandler);

    // Escuchar cambios de selección de Quill
    this.quillSelectionChangeHandler = () => {
      // No deseleccionar si estamos restaurando selección, resizing, aplicando formato o actualizando tamaño
      if (this.isRestoringSelection || this.isApplyingFormat || isResizeOperationActive(this.isResizing, this.isUpdatingElementSize)) {
        return;
      }

      // Si hay una imagen seleccionada y se está aplicando formato, mantener la selección
      if (this.selectedElement) {
        // Verificar si la selección actual incluye la imagen
        const selection = this.quillInstance.getSelection(false);
        if (selection) {
          const imageIndex = getElementIndexInQuill(this.quillInstance, this.editorElement, this.selectedElement);
          if (imageIndex !== null && selection.index === imageIndex) {
            // La selección está en la imagen, mantenerla seleccionada
            return;
          }
        }

        // Si hay una imagen seleccionada pero la selección cambió, NO deseleccionar automáticamente
        // Solo mantener la selección de la imagen activa
        return;
      }

      // Solo deseleccionar si realmente se hizo clic fuera y no hay selección de texto
      const selection = this.quillInstance.getSelection(false);
      if (!selection || selection.length === 0) {
        // Si no hay selección de texto, no deseleccionar la imagen automáticamente
        // Solo deseleccionar si se hace clic fuera del editor (manejado en setupEventListeners)
        return;
      }
    };

    this.quillInstance.on('selection-change', this.quillSelectionChangeHandler);
  }

  private setupEventListeners(): void {
    // Variables para rastrear si el usuario está haciendo drag
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    const DRAG_THRESHOLD = 5; // Píxeles mínimos para considerar que es un drag

    // Mousedown en imágenes - preparar para posible drag
    this.eventManager.add(this.editorElement, 'mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      const img = target.closest('img, iframe, .ql-video-wrapper');

      if (img && isElementContained(img, this.editorElement) && img.classList.contains(IMAGE_RESIZABLE_CLASS)) {
        // Guardar posición inicial para detectar si es drag o click
        dragStartX = mouseEvent.clientX;
        dragStartY = mouseEvent.clientY;
        isDragging = false;
      }
    }, true);

    // Mousemove para detectar si el usuario está arrastrando Y para manejar el drag manualmente
    this.eventManager.add(this.editorElement, 'mousemove', (e: Event) => {
      const mouseEvent = e as MouseEvent;

      // Si hay un drag activo, manejar el mousemove como dragover
      if (this.isNativeDragActive && mouseEvent.buttons === 1) {
        // Verificar que el mouse está dentro del editor
        const editorRect = this.editorElement.getBoundingClientRect();
        const isInsideEditor = mouseEvent.clientX >= editorRect.left && mouseEvent.clientX <= editorRect.right &&
          mouseEvent.clientY >= editorRect.top && mouseEvent.clientY <= editorRect.bottom;

        if (isInsideEditor) {
          // Crear un objeto que simula DragEvent para las funciones que lo necesitan
          const dragEvent = {
            clientX: mouseEvent.clientX,
            clientY: mouseEvent.clientY,
            dataTransfer: {
              types: ['text/html', 'text/plain'],
              effectAllowed: 'move'
            }
          } as unknown as DragEvent;

          this.updateDropIndicatorFromDragEvent(dragEvent);
          this.updateQuillSelectionDuringDrag(dragEvent);
        } else {
          // Si está fuera del editor, ocultar el indicador
          if (this.dropIndicator) {
            this.dropIndicator.style.display = 'none';
          }
        }
      }

      // Detectar si el usuario está arrastrando (para distinguir de click)
      if (mouseEvent.buttons === 1) { // Botón izquierdo presionado
        const deltaX = Math.abs(mouseEvent.clientX - dragStartX);
        const deltaY = Math.abs(mouseEvent.clientY - dragStartY);

        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          isDragging = true;
        }
      }
    });

    // Click en imágenes
    this.eventManager.add(this.editorElement, 'click', (e: Event) => {
      // No procesar clicks durante resize o actualización de tamaño
      if (isResizeOperationActive(this.isResizing, this.isUpdatingElementSize)) {
        return;
      }

      // Si el usuario estaba arrastrando, no procesar el click
      if (isDragging) {
        isDragging = false;
        return;
      }

      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      const img = target.closest('img, iframe, div.image-resizable, .ql-video-wrapper');

      // Si es un click en una imagen, seleccionarla siempre (sin importar dónde esté el cursor)
      if (img && isElementContained(img, this.editorElement)) {
        // NO prevenir el comportamiento por defecto si el usuario estaba arrastrando
        // Esto permite que el drag funcione correctamente
        if (!isDragging) {
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();
          this.selectElement(img as HTMLElement);
        }
        return;
      }

      // Si no es click en imagen ni en handles, verificar si deseleccionar
      if (!isResizeHandles(target) && !isResizeHandle(target)) {
        const selection = this.quillInstance.getSelection(false);
        // Solo deseleccionar si realmente no hay selección de texto activa
        if (!selection || selection.length === 0) {
          this.deselectElement();
        }
      }
    }, true);

    // Mousemove para resize
    this.eventManager.add(document, 'mousemove', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      // Solo procesar si realmente estamos resizing
      if (this.isResizing) {
        // Verificar que el mouse está presionado (botón izquierdo = 1)
        // buttons puede ser 0, 1 (izquierdo), 2 (derecho), 4 (medio), etc.
        if (mouseEvent.buttons === 0) {
          // Mouse no está presionado, pero isResizing es true - esto puede pasar si mouseup no se procesó
          this.stopResize();
          return;
        }

        mouseEvent.preventDefault(); // Prevenir comportamiento por defecto para mejor rendimiento
        mouseEvent.stopPropagation(); // Evitar que el evento se propague
        this.handleResize(mouseEvent);
      }
    });

    // Mouseup para finalizar resize Y para manejar el drop manual
    this.eventManager.add(document, 'mouseup', (e: Event) => {
      // Si hay un drag activo, procesar como drop
      if (this.isNativeDragActive && !this.isResizing) {
        const mouseEvent = e as MouseEvent;

        // Verificar que el mouse está dentro del editor antes de procesar el drop
        const editorRect = this.editorElement.getBoundingClientRect();
        const isInsideEditor = mouseEvent.clientX >= editorRect.left && mouseEvent.clientX <= editorRect.right &&
          mouseEvent.clientY >= editorRect.top && mouseEvent.clientY <= editorRect.bottom;

        if (!isInsideEditor) {
          this.cleanupDrag();
          return;
        }

        // Calcular el índice directamente desde las coordenadas del mouse

        const dropIndex = getQuillIndexFromPoint(this.quillInstance, mouseEvent.clientX, mouseEvent.clientY);

        // Obtener información del contenido actual para debug
        if (this.quillInstance) {
          const currentLength = this.quillInstance.getLength();

          if (isValidQuillIndex(dropIndex) && dropIndex !== null) {
            const contentAtDrop = this.quillInstance.getContents(dropIndex, Math.min(5, currentLength - dropIndex));

            // Verificar si hay una imagen justo antes del dropIndex
            if (dropIndex > 0) {
              const contentBeforeDrop = this.quillInstance.getContents(dropIndex - 1, 1);

              // Si hay una imagen justo antes y el dropIndex está en un bloque vacío, ajustar
              if (contentBeforeDrop.ops && contentBeforeDrop.ops.length > 0) {
                const opBefore = contentBeforeDrop.ops[0];
                if (opBefore.insert && typeof opBefore.insert === 'object' && opBefore.insert.image) {
                  const imageIndex = dropIndex - 1;
                  const expectedIndexAfterImage = imageIndex + 1;

                  // Verificar si el dropIndex está en un bloque vacío
                  const isAtEmptyBlock = !contentAtDrop.ops ||
                    contentAtDrop.ops.length === 0 ||
                    (contentAtDrop.ops.length === 1 &&
                      contentAtDrop.ops[0].insert === '\n');


                  // Si el dropIndex está en un bloque vacío y es diferente del índice esperado después de la imagen,
                  // ajustar para que apunte justo después de la imagen
                  if (isAtEmptyBlock && dropIndex !== null && dropIndex !== expectedIndexAfterImage && dropIndex <= expectedIndexAfterImage + 2) {
                    const adjustedDropIndex: number = expectedIndexAfterImage;
                    if (isValidQuillIndex(this.originalElementIndex) && adjustedDropIndex !== this.originalElementIndex) {
                      this.moveImageToPosition(adjustedDropIndex, this.originalElementIndex);
                    }
                    this.cleanupDrag();
                    return;
                  }
                }
              }
            }
          }

          if (isValidQuillIndex(this.originalElementIndex)) {
            const contentAtOriginal = this.quillInstance.getContents(this.originalElementIndex, 1);
          }
        }

        // Usar el índice original, no el lastDropPosition que se actualiza durante el drag
        if (isValidQuillIndex(dropIndex) && isValidQuillIndex(this.originalElementIndex)) {

          // Solo mover si el índice es diferente del original
          if (dropIndex !== this.originalElementIndex) {
            this.moveImageToPosition(dropIndex, this.originalElementIndex);
          } else {
          }
        } else {
        }

        this.cleanupDrag();
        return;
      }

      // Solo procesar si realmente estamos resizing y no estamos ya procesando un stop
      if (this.isResizing && !this.isUpdatingElementSize) {
        this.stopResize();
      }
    });

    // Click fuera para deseleccionar
    this.eventManager.add(document, 'click', (e: Event) => {
      // No procesar clicks durante resize o actualización de tamaño
      if (isResizeOperationActive(this.isResizing, this.isUpdatingElementSize)) {
        return;
      }

      const target = e.target as HTMLElement;
      if (!isElementContained(target, this.editorElement) &&
        !isResizeHandles(target) &&
        !target.closest('.ql-toolbar')) {
        this.deselectElement();
      }
    }, true);

    // Scroll y resize para actualizar posición de handles
    const updateHandlesOnScroll = () => {
      if (this.selectedElement) {
        this.updateHandlesPosition();
      }
    };

    this.eventManager.add(this.containerElement, 'scroll', updateHandlesOnScroll);
    this.eventManager.add(window, 'scroll', updateHandlesOnScroll, true);
    this.eventManager.add(window, 'resize', updateHandlesOnScroll);

    // Listener global para debug - verificar si dragover se dispara en algún lugar
    // Usar capture phase para capturar ANTES que cualquier otro handler
    const globalDragoverDebug = (e: Event) => {
      const dragEvent = e as DragEvent;
      // Handler para dragover global
    };
    this.eventManager.add(document, 'dragover', globalDragoverDebug, true);

    // También añadir un listener directo en el editor usando addEventListener nativo
    // para asegurar que capturamos el evento incluso si Quill lo bloquea
    const nativeDragoverHandler = (e: DragEvent) => {
      // Prevenir el default SIEMPRE para permitir drop
      e.preventDefault();
      e.stopPropagation();

      const hasImageData = e.dataTransfer?.types?.includes('text/html') ||
        e.dataTransfer?.types?.includes('text/plain');

      if (this.isNativeDragActive || hasImageData) {
        if (!this.isNativeDragActive && hasImageData) {
          this.isNativeDragActive = true;
        }
        this.updateDropIndicatorFromDragEvent(e);
        this.updateQuillSelectionDuringDrag(e);
      }
    };
    this.editorElement.addEventListener('dragover', nativeDragoverHandler, false);
    // Guardar referencia para poder removerlo después
    (this.editorElement as any)._nativeDragoverHandler = nativeDragoverHandler;

    // Drag and drop nativo
    // Usar capture phase para asegurar que capturamos el evento antes que otros handlers
    this.eventManager.add(this.editorElement, 'dragstart', (e: Event) => {
      const dragEvent = e as DragEvent;
      const target = dragEvent.target as any;

      // Buscar la imagen (puede ser el target directo o un ancestro)
      let el: HTMLElement | null = null;
      if (isValidResizableElement(target)) {
        el = target;
      } else {
        el = target?.closest?.(`img.${IMAGE_RESIZABLE_CLASS}, iframe.${IMAGE_RESIZABLE_CLASS}, div.${IMAGE_RESIZABLE_CLASS}, .ql-video-wrapper`) as HTMLElement | null;
      }

      if (el && isElementContained(el, this.editorElement)) {

        // CRÍTICO: Para contenteditable, necesitamos prevenir el default para evitar que el navegador
        // intente hacer drag del contenido editable. En su lugar, manejaremos el drag manualmente.
        dragEvent.preventDefault();
        dragEvent.stopPropagation();

        // Establecer datos del drag (necesario para algunos navegadores)
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.effectAllowed = 'move';
          // Usar setData para permitir el drop
          dragEvent.dataTransfer.setData('text/html', el.outerHTML);
          dragEvent.dataTransfer.setData('text/plain', (el as any).src || '');
        } else {
        }

        // Iniciar el drag manualmente
        this.handleDragStart(el);

        // Añadir clase visual para indicar que está siendo arrastrada
        el.style.opacity = '0.5';
        el.style.cursor = 'grabbing';
      }
    }, true); // true = usar capture phase

    // IMPORTANTE: dragover debe prevenir el default SIEMPRE para permitir el drop
    this.eventManager.add(this.editorElement, 'dragover', (e: Event) => {
      const dragEvent = e as DragEvent;

      // Verificar si hay una imagen siendo arrastrada (por el dataTransfer o por la clase)
      const hasImageData = dragEvent.dataTransfer?.types?.includes('text/html') ||
        dragEvent.dataTransfer?.types?.includes('text/plain');

      if (this.isNativeDragActive || hasImageData) {
        // CRÍTICO: preventDefault es necesario para permitir el drop
        preventDragDefault(dragEvent);

        // Si no estaba activo, activarlo ahora
        if (!this.isNativeDragActive && hasImageData) {
          this.isNativeDragActive = true;
        }

        this.updateDropIndicatorFromDragEvent(dragEvent);
        this.updateQuillSelectionDuringDrag(dragEvent);
      } else {
      }
    }, false); // No usar capture para dragover, puede interferir

    this.eventManager.add(document, 'dragover', (e: Event) => {
      const dragEvent = e as DragEvent;
      const hasImageData = dragEvent.dataTransfer?.types?.includes('text/html') ||
        dragEvent.dataTransfer?.types?.includes('text/plain');

      if (this.isNativeDragActive || hasImageData) {
        dragEvent.preventDefault();
        this.updateDropIndicatorFromDragEvent(dragEvent);

        // Si no estaba activo, activarlo ahora
        if (!this.isNativeDragActive && hasImageData) {
          this.isNativeDragActive = true;
        }
      }
    });

    this.eventManager.add(this.editorElement, 'drop', (e: Event) => {
      const dragEvent = e as DragEvent;

      // Verificar si hay datos de imagen en el dataTransfer
      const hasImageData = dragEvent.dataTransfer?.types?.includes('text/html') ||
        dragEvent.dataTransfer?.types?.includes('text/plain');


      if (this.isNativeDragActive || hasImageData) {
        preventDragDefault(dragEvent);

        // Si no estaba activo pero hay datos de imagen, intentar activarlo
        if (!this.isNativeDragActive && hasImageData) {
          // Intentar obtener la imagen desde los datos
          const imageHtml = dragEvent.dataTransfer?.getData('text/html');
          if (imageHtml) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(imageHtml, 'text/html');
            const droppedEl = doc.querySelector('img, iframe, div.image-resizable, .ql-video-wrapper');
            const dropSrc = (droppedEl as any)?.src;
            if (dropSrc) {
              const existingEl = this.editorElement.querySelector(`img[src="${dropSrc}"], iframe[src="${dropSrc}"], div[src="${dropSrc}"]`) as HTMLElement;
              if (existingEl) {
                this.handleDragStart(existingEl);
              }
            }
          }
        }

        const dropIndex = this.getDropPositionFromDragEvent(dragEvent);
        if (isValidQuillIndex(dropIndex) && isValidQuillIndex(this.lastDropPosition?.index)) {
          this.moveImageToPosition(dropIndex);
        }

        this.cleanupDrag();
      }
    });

    this.eventManager.add(document, 'dragend', () => {
      if (this.isNativeDragActive) {
        this.cleanupDrag();
      }
    });
  }

  private handleDragStart(img: HTMLElement): void {

    // Log de la estructura del editor al inicio del drag
    // console.log('🔍 [DRAG] Inicio del drag:', img); // Eliminado para reducir ruido

    // CRÍTICO: Asegurar que no quede ningún estado de resize activo al iniciar un drag
    this.isResizing = false;
    this.isNativeDragActive = true;


    this.selectedElement = img;

    // Ocultar el cursor nativo del editor durante el drag
    this.editorElement.classList.add('hide-native-cursor');

    const dragData = prepareImageForDrag(img, this.quillInstance, this.editorElement);

    this.createDropIndicator();

    // Guardar el índice ORIGINAL de la imagen (no se actualiza durante el drag)
    this.originalElementIndex = dragData.index !== -1 ? dragData.index : null;

    // Guardar las dimensiones ORIGINALES de la imagen
    this.originalElementDimensions = dragData.dimensions;

    this.lastDropPosition = {
      x: dragData.position.x,
      y: dragData.position.y,
      index: dragData.index !== -1 ? dragData.index : null
    };
  }

  private handleQuillTextChange(): void {
    if (!this.selectedElement) {
      return;
    }

    const imageSrc = (this.selectedElement as any).src;
    const currentSelection = this.quillInstance.getSelection(false);
    const imageIndex = getElementIndexInQuill(this.quillInstance, this.editorElement, this.selectedElement);

    // Verificar si el usuario está escribiendo texto
    // Si la selección existe y NO está en la imagen (incluso si length es 0, es un cursor), el usuario está escribiendo
    const isWritingText = currentSelection &&
      imageIndex !== null &&
      currentSelection.index !== imageIndex;

    // Si el usuario está escribiendo texto, NO restaurar la selección de la imagen
    if (isWritingText) {
      // Solo actualizar posición de handles si la imagen sigue visible, pero NO cambiar la selección de Quill
      if (this.resizeHandles && this.selectedElement.isConnected) {
        this.updateHandlesPosition();
      }
      return;
    }

    // Preservar la selección de la imagen después de que Quill procese cambios
    preserveElementSelectionAfterQuillUpdate(
      this.selectedElement,
      imageSrc,
      this.editorElement,
      (restoredImage) => {
        // Restaurar selección completa (imagen + handles)
        const result = restoreCompleteElementSelection(
          restoredImage,
          imageSrc,
          this.editorElement,
          this.resizeHandles,
          (handle, e) => this.startResize(handle, e)
        );

        if (result.element) {
          this.selectedElement = result.element;
          this.resizeHandles = result.handles;
          this.updateHandlesPosition();
        }
      }
    );

    // Verificar si la imagen seleccionada aún existe
    const resizableImages = findResizableElements(this.editorElement);
    if (!resizableImages.includes(this.selectedElement)) {
      // Intentar restaurar selección completa
      const result = restoreCompleteElementSelection(
        this.selectedElement,
        imageSrc,
        this.editorElement,
        this.resizeHandles,
        (handle, e) => this.startResize(handle, e)
      );

      if (result.element) {
        this.selectedElement = result.element;
        this.resizeHandles = result.handles;
        this.updateHandlesPosition();
      } else {
        this.deselectElement();
        return;
      }
    }

    // Preservar los estilos de tamaño si existen
    const saved = this.styleManager.getStyle(imageSrc);

    if (hasValidImageStyle(saved) && saved) {
      const imageRef = this.selectedElement;

      // Restaurar estilos después de que Quill procese (optimizado)
      restoreStylesAfterQuillUpdate(
        this.selectedElement as any,
        imageSrc,
        saved,
        this.quillInstance,
        this.editorElement,
        (foundImage) => {
          // Restaurar selección completa después de restaurar estilos
          const result = restoreCompleteElementSelection(
            foundImage,
            imageSrc,
            this.editorElement,
            this.resizeHandles,
            (handle, e) => this.startResize(handle, e)
          );

          if (result.element) {
            this.selectedElement = result.element;
            this.resizeHandles = result.handles;
            this.styleManager.saveStyle((result.element as any).src, saved);
            this.updateHandlesPosition();
          }
        },
        () => {
          this.updateHandlesPosition(true);
        }
      );
    }

    // Actualizar posición de handles después de un breve delay para asegurar que Quill haya procesado
    executeAfterDelay(() => {
      if (this.selectedElement) {
        this.updateHandlesPosition();
      }
    }, STYLE_UPDATE_DELAY);
  }

  private selectElement(el: HTMLElement, forceUpdate: boolean = false): void {
    // Si es la misma imagen y no se fuerza actualización, solo actualizar posición de handles
    if (this.selectedElement === el && !forceUpdate) {
      this.updateHandlesPosition(true);
      return;
    }

    this.deselectElement();
    this.selectedElement = el;
    markElementAsResizable(el);
    el.classList.add('is-selected');

    // Establecer la selección de Quill en la imagen cuando se selecciona explícitamente
    // Esto asegura que la imagen esté seleccionada correctamente cuando el usuario hace click en ella
    const imageIndex = getElementIndexInQuill(this.quillInstance, this.editorElement, el);

    if (imageIndex !== null) {
      // Verificar si el usuario está escribiendo texto antes de establecer la selección
      const currentSelection = this.quillInstance.getSelection(false);
      const isUserTyping = currentSelection &&
        currentSelection.index !== imageIndex &&
        currentSelection.length === 0; // Cursor activo, no selección

      // Solo establecer la selección en la imagen si el usuario NO está escribiendo texto
      // Si el usuario está escribiendo texto, mantener su cursor donde está
      // También verificar si viene de una restauración automática (no cambiar selección en ese caso)
      const caller = new Error().stack?.split('\n')[2]?.trim() || '';
      const isFromRestore = caller.includes('restoreCompleteElementSelection') || caller.includes('handleQuillTextChange');

      if (!isUserTyping && !isFromRestore) {
        this.quillInstance.setSelection(imageIndex, 1, 'silent');
      }
    }

    this.createResizeHandles(el);
    // Actualizar posición (updateHandlesPosition ya maneja múltiples requestAnimationFrame cuando immediate=true)
    this.updateHandlesPosition(true);

    this.applyImageStyleIfNeeded(el);
    this.setupImageStyleObserver(el);
  }

  private applyImageStyleIfNeeded(img: HTMLElement): void {
    const savedStyle = this.styleManager.getStyle((img as any).src);
    const currentStyle = img.getAttribute('style') || '';

    if (hasValidImageStyle(savedStyle) && savedStyle) {
      applyImageStyles(img, savedStyle.style, savedStyle.width, savedStyle.height, this.quillInstance);
    } else if (currentStyle.includes('width') || currentStyle.includes('height')) {
      this.styleManager.saveStyle((img as any).src, {
        width: img.style.width || '',
        height: img.style.height || '',
        style: currentStyle
      });
    }
  }

  private setupImageStyleObserver(img: HTMLElement): void {
    // Observar el contenedor padre para detectar cambios de posición (cuando Quill mueve la imagen)
    const container = img.parentElement || this.editorElement;

    this.observerManager.observe({
      target: container,
      callback: (mutations) => {
        // Ignorar cambios durante el resize o cuando se está aplicando formato
        if (isResizeOperationActive(this.isResizing, this.isUpdatingElementSize) || this.isApplyingFormat) {
          return;
        }

        let shouldUpdateHandles = false;

        mutations.forEach((mutation) => {
          // Si hay cambios en el árbol DOM, la imagen puede haberse movido
          if (mutation.type === 'childList') {
            // Verificar si la imagen seleccionada está en los nodos afectados
            const affectedNodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));
            const imageAffected = affectedNodes.some(node =>
              node === this.selectedElement ||
              (node.nodeType === Node.ELEMENT_NODE && (node as Element).contains(this.selectedElement))
            );

            if (imageAffected) {
              shouldUpdateHandles = true;
            }
          }

          // Si hay cambios en atributos de estilo de la imagen seleccionada
          if (mutation.type === 'attributes' &&
            mutation.attributeName === 'style' &&
            mutation.target === this.selectedElement) {
            this.handleStyleMutation(mutation.target as HTMLElement);
            shouldUpdateHandles = true;
          }
        });

        // Actualizar posición de handles inmediatamente si la imagen se movió o cambió
        if (shouldUpdateHandles && this.selectedElement && this.resizeHandles) {
          // Usar múltiples requestAnimationFrame para asegurar que el DOM se haya actualizado
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (this.selectedElement && this.resizeHandles) {
                this.updateHandlesPosition(true);
              }
            });
          });
        }
      },
      options: {
        attributes: true,
        attributeFilter: ['style'],
        childList: true,
        subtree: true
      }
    });
  }

  private handleStyleMutation(target: HTMLElement): void {
    const saved = this.styleManager.getStyle((target as any).src);
    if (!hasValidImageStyle(saved) || !saved) return;

    const currentWidth = target.style.width;
    const currentHeight = target.style.height;

    if (currentWidth !== saved.width || currentHeight !== saved.height) {
      applyImageStyles(target, saved.style, saved.width, saved.height, this.quillInstance);
    }
  }

  private deselectElement(): void {
    if (this.selectedElement) {
      this.observerManager.disconnect(this.selectedElement);
      unmarkElementAsResizable(this.selectedElement);
      this.selectedElement.classList.remove('is-selected');
      this.selectedElement = null;
    }

    removeImageSelection(null, this.resizeHandles);
    this.resizeHandles = null;
  }


  private createResizeHandles(img: HTMLElement): void {
    // Usar función helper para asegurar que los handles estén visibles
    this.resizeHandles = ensureHandlesVisible(
      this.resizeHandles,
      img,
      this.editorElement,
      (img as any).src,
      (handle, e) => this.startResize(handle, e)
    );

    this.updateHandlesPosition();

    // CRÍTICO: Protección contra "ghost clicks" en los handles recién creados
    // Deshabilitar interacción brevemente para evitar que se activen inmediatamente por un evento mouseup/click residual
    if (this.resizeHandles) {
      const handles = this.resizeHandles;
      handles.style.pointerEvents = 'none';
      setTimeout(() => {
        if (isInDOM(handles)) {
          handles.style.pointerEvents = '';
        }
      }, 500);
    }
  }

  private updateHandlesPosition(immediate: boolean = false): void {
    if (!this.selectedElement || !this.resizeHandles) {
      return;
    }

    // Evitar actualizaciones duplicadas durante el proceso de formato
    if (this.isUpdatingHandlesPosition && immediate) {
      return;
    }

    // Guardar referencias para el callback
    const selectedImage = this.selectedElement;
    const resizeHandles = this.resizeHandles;

    const updatePosition = () => {
      // Verificar que las referencias siguen siendo válidas
      if (!selectedImage || !resizeHandles || !this.selectedElement || !this.resizeHandles) {
        this.isUpdatingHandlesPosition = false;
        return;
      }

      // Verificar que los elementos siguen en el DOM
      const handlesInDOM = isInDOM(resizeHandles);
      const imageInEditor = isElementContained(selectedImage, this.editorElement);

      if (!handlesInDOM || !imageInEditor) {
        // Si la imagen no está en el editor o los handles no están en el DOM, intentar encontrar la nueva imagen por src
        if ((!imageInEditor || !handlesInDOM) && this.selectedElement) {
          const imageSrc = (this.selectedElement as any).src;
          const foundImage = Array.from(this.editorElement.querySelectorAll('img, iframe, div.image-resizable, .ql-video-wrapper')).find(
            (el: any) => el.src === imageSrc
          ) as HTMLElement | undefined;

          if (foundImage && foundImage !== this.selectedElement) {
            // Imagen recreada encontrada, actualizar selección
            this.isUpdatingHandlesPosition = false;
            requestAnimationFrame(() => {
              this.selectElement(foundImage, true);
            });
            return;
          } else if (foundImage && foundImage === this.selectedElement && !handlesInDOM) {
            // Misma imagen pero handles no en DOM, recrearlos
            if (this.resizeHandles && !isInDOM(this.resizeHandles)) {
              this.createResizeHandles(foundImage);
              this.isUpdatingHandlesPosition = false;
              this.updateHandlesPosition(true);
            }
            return;
          }
        }

        this.isUpdatingHandlesPosition = false;
        return;
      }

      // Forzar reflow para asegurar que el navegador haya calculado la nueva posición
      void selectedImage.offsetHeight;

      const imgRect = selectedImage.getBoundingClientRect();
      const containerRect = this.containerElement.getBoundingClientRect();

      // Calcular posición relativa al contenedor del editor
      // Usar getBoundingClientRect para obtener coordenadas del viewport y convertirlas a relativas
      const relativeTop = imgRect.top - containerRect.top + this.containerElement.scrollTop;
      const relativeLeft = imgRect.left - containerRect.left + this.containerElement.scrollLeft;

      // Aplicar posición relativa al contenedor (position: absolute dentro del contenedor)
      resizeHandles.style.top = `${relativeTop}px`;
      resizeHandles.style.left = `${relativeLeft}px`;
      resizeHandles.style.width = `${imgRect.width}px`;
      resizeHandles.style.height = `${imgRect.height}px`;

      this.isUpdatingHandlesPosition = false;
    };

    // Si es inmediato, usar múltiples requestAnimationFrame para asegurar que el layout se haya completado
    if (immediate) {
      this.isUpdatingHandlesPosition = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(updatePosition);
        });
      });
    } else {
      // Usar throttling para actualizaciones normales (scroll, resize, etc.)
      this.handlesPositionThrottle.execute(updatePosition);
    }
  }

  /**
   * Método público para actualizar la posición de los handles (útil para uso externo)
   */
  updateHandlesPositionPublic(immediate: boolean = true): void {
    this.updateHandlesPosition(immediate);
  }

  private startResize(handle: HTMLElement, e: MouseEvent): void {

    if (!this.selectedElement) return;

    // Asegurar que no estamos bloqueados por una actualización anterior

    // CRÍTICO: Verificar si estamos en periodo de "cooldown" después de un drag
    const timeSinceDrag = Date.now() - this.lastDragEndTime;
    if (timeSinceDrag < 1500) {
      // console.log('⚠️ [RESIZE START] Blocked due to recent drag cooldown:', timeSinceDrag);
      return;
    }

    this.isUpdatingElementSize = false;

    // Deshabilitar el observer durante el resize para evitar interferencias
    if (this.selectedElement) {
      this.observerManager.disconnect(this.selectedElement);
    }

    this.isResizing = true;
    this.resizeHandle = handle.classList[1]; // nw, ne, sw, se, n, s, w, e
    this.startX = e.clientX;
    this.startY = e.clientY;

    const dimensions = getImageDimensions(this.selectedElement);
    this.startWidth = dimensions.width;
    this.startHeight = dimensions.height;
    this.startAspectRatio = this.startWidth / this.startHeight;

    disableUserSelect(this.selectedElement);
    setDocumentCursor(handle.style.cursor || 'default');
  }

  private handleResize(e: MouseEvent): void {
    // Verificación estricta: solo procesar si realmente estamos resizing
    if (!this.selectedElement || !this.isResizing || this.isUpdatingElementSize) {
      return;
    }

    // Seguridad adicional: si estamos dragging, no permitir resize
    if (this.isNativeDragActive) {
      console.warn('⚠️ [RESIZE] Attempted to resize while dragging. Stopping resize.');
      this.isResizing = false;
      return;
    }

    // Prevenir que se ejecute si el mouse ya no está presionado
    // (esto puede pasar si hay eventos mousemove en cola después de mouseup)
    if (e.buttons === 0) {
      // El mouse ya no está presionado, pero isResizing aún es true
      // Esto significa que mouseup no se ha procesado aún, forzar stopResize
      this.stopResize();
      return;
    }

    // CRÍTICO: Verificar si estamos en periodo de "cooldown" después de un drag
    // Esto es doble protección por si isResizing quedó activo
    const timeSinceDrag = Date.now() - this.lastDragEndTime;
    if (timeSinceDrag < 1500) {
      // console.log('⚠️ [RESIZE] Blocked due to recent drag cooldown:', timeSinceDrag);
      this.isResizing = false; // Forzar stop
      return;
    }

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    const result = calculateResizeDimensions({
      handle: this.resizeHandle,
      deltaX,
      deltaY,
      startWidth: this.startWidth,
      startHeight: this.startHeight,
      startAspectRatio: this.startAspectRatio
    });

    const widthStr = formatDimension(result.width);
    const heightStr = formatDimension(result.height);

    // DEBUG: Log para ver qué está pasando
    // const tagName = this.selectedElement.tagName.toLowerCase();
    // const isVideo = tagName === 'div' && this.selectedElement.classList.contains('ql-video-wrapper');
    // console.log(`🔍 [RESIZE] Element: ${isVideo ? 'VIDEO' : 'IMAGE'}, W: ${widthStr}, H: ${heightStr}`);

    // Actualizar estilos DIRECTAMENTE sin requestAnimationFrame para respuesta inmediata
    // Esto asegura que la imagen se actualice en tiempo real durante el arrastre
    if (this.selectedElement && this.isResizing && !this.isUpdatingElementSize) {
      // Usar función especializada para aplicar estilos durante resize
      applyResizeStyles(this.selectedElement, widthStr, heightStr);

      // Actualizar handles de forma throttled (ya tiene throttling interno)
      this.updateHandlesPosition();
    }
  }

  private stopResize(): void {
    // Protección contra múltiples llamadas
    if (this.isUpdatingElementSize) {
      return;
    }

    if (!this.selectedElement) {
      return;
    }

    if (!this.isResizing) {
      return;
    }

    // Marcar primero para evitar llamadas duplicadas
    this.isUpdatingElementSize = true;
    this.isResizing = false;
    enableUserSelect(this.selectedElement);
    resetDocumentCursor();

    // Re-habilitar el observer después del resize
    if (this.selectedElement) {
      this.setupImageStyleObserver(this.selectedElement);
    }

    const dimensions = getCurrentImageDimensions(this.selectedElement);
    const width = normalizeDimension(dimensions.width, `${this.startWidth}px`);
    const height = normalizeDimension(dimensions.height, `${this.startHeight}px`);

    const existingStyle = this.selectedElement.getAttribute('style') || '';
    const newStyle = buildImageStyle(width, height, existingStyle);

    const imageStyle: ImageStyle = {
      width,
      height,
      style: newStyle
    };

    // Guardar referencia de la imagen antes de que Quill pueda recrearla
    const imageRef = this.selectedElement;
    const imageSrc = (imageRef as any).src;

    // Guardar y aplicar estilos
    this.styleManager.saveStyle(imageSrc, imageStyle);
    applyImageStyles(imageRef, newStyle, width, height, this.quillInstance);
    applyStylesToAllImagesWithSrc(imageSrc, imageStyle, this.quillInstance);

    // Asegurar que los handles estén visibles ANTES de llamar a onElementUpdate
    this.resizeHandles = ensureHandlesVisible(
      this.resizeHandles,
      imageRef,
      this.editorElement,
      imageSrc,
      (handle, e) => this.startResize(handle, e)
    );
    this.updateHandlesPosition();

    // Llamar a onElementUpdate después de asegurar que los handles están creados
    this.onElementUpdate();

    // Verificar y restaurar estilos después de que Quill procese (optimizado)
    restoreStylesAfterQuillUpdate(
      imageRef,
      imageSrc,
      imageStyle,
      this.quillInstance,
      this.editorElement,
      (foundImage) => {
        // Restaurar selección completa después de restaurar estilos
        const result = restoreCompleteElementSelection(
          foundImage,
          imageSrc,
          this.editorElement,
          this.resizeHandles,
          (handle, e) => this.startResize(handle, e)
        );

        if (result.element) {
          this.selectedElement = result.element;
          this.resizeHandles = result.handles;
          this.styleManager.saveStyle((result.element as any).src, imageStyle);
          this.updateHandlesPosition();
        }
      },
      () => {
        console.log('🔍 [HANDLER] Styles restored in stopResize, updating handles');
        this.updateHandlesPosition(true);
      }
    );

    // Usar executeAfterDelay para asegurar que los handles se mantengan visibles
    // Usar un delay más largo para asegurar que onContentChange haya terminado
    executeAfterDelay(() => {
      // Restaurar selección completa si es necesario
      const result = restoreCompleteElementSelection(
        this.selectedElement,
        imageSrc,
        this.editorElement,
        this.resizeHandles,
        (handle, e) => this.startResize(handle, e)
      );

      if (result.element) {
        this.selectedElement = result.element;
        this.resizeHandles = result.handles;
        this.updateHandlesPosition();
      }

      // Desmarcar flag después de asegurar que todo está en orden
      this.isUpdatingElementSize = false;
    }, STYLE_UPDATE_DELAY * 2); // Delay más largo para asegurar que onContentChange haya terminado
  }



  private createDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.remove();
    }

    this.dropIndicator = createDropIndicator();
    document.body.appendChild(this.dropIndicator);

    // Observer para reconectar si Quill lo elimina
    this.observerManager.observe({
      target: document.body,
      callback: () => {
        if (!isInDOM(this.dropIndicator) && !this.isReconnectingIndicator) {
          this.isReconnectingIndicator = true;
          setTimeout(() => {
            if (this.dropIndicator && !isInDOM(this.dropIndicator)) {
              document.body.appendChild(this.dropIndicator);
            }
            this.isReconnectingIndicator = false;
          }, 0);
        }
      },
      options: {
        childList: true,
        subtree: true
      }
    });
  }

  private updateDropIndicatorFromDragEvent(e: DragEvent): void {
    if (!this.dropIndicator) {
      return;
    }

    const isInside = isDragInsideEditor(e, this.editorElement);

    if (isInside) {
      const coords = getDragCoordinates(e);
      updateDropIndicatorPosition(this.dropIndicator, coords.x, coords.y, this.editorElement);
      const display = this.dropIndicator.style.display;
    } else {
      this.dropIndicator.style.display = 'none';
    }
  }

  private updateQuillSelectionDuringDrag(e: DragEvent): void {
    if (!isDragInsideEditor(e, this.editorElement)) {
      return;
    }

    const coords = getDragCoordinates(e);

    const index = getQuillIndexFromPoint(this.quillInstance, coords.x, coords.y);

    if (isValidQuillIndex(index)) {
      // No establecer la selección durante el drag para evitar mostrar el cursor nativo
      // El indicador azul ya muestra la posición de inserción
      // Solo guardar la posición para el drop
      this.lastDropPosition = {
        x: coords.x,
        y: coords.y,
        index: index
      };
    } else {
    }
  }

  private getDropPositionFromDragEvent(e: DragEvent): number | null {
    if (!isDragInsideEditor(e, this.editorElement)) {
      return null;
    }

    const coords = getDragCoordinates(e);


    const index = getQuillIndexFromPoint(this.quillInstance, coords.x, coords.y);



    // Si tenemos un índice válido, guardarlo para el drop
    if (isValidQuillIndex(index)) {
      this.lastDropPosition = {
        x: coords.x,
        y: coords.y,
        index: index
      };
    }

    return index;
  }

  private moveImageToPosition(newIndex: number, oldIndex?: number): void {
    // Usar el índice proporcionado o el original guardado
    const originalIndex = oldIndex ?? this.originalElementIndex;



    if (!this.selectedElement || !isValidQuillIndex(originalIndex) || !isValidQuillIndex(newIndex)) {
      return;
    }

    const imageUrl = this.selectedElement.getAttribute('src');
    if (!imageUrl) {
      return;
    }

    // Obtener información del estado actual del editor
    const editorLength = this.quillInstance.getLength();



    // Verificar que los índices están dentro del rango válido
    if (originalIndex >= editorLength || newIndex > editorLength) {
      return;
    }

    // Verificar si hay un salto de línea entre la imagen original y el índice objetivo
    // Si hay un salto de línea, significa que el usuario quiere colocar la imagen en un nuevo párrafo
    // En ese caso, NO ajustamos el índice aquí, dejamos que moveImageInQuill lo ajuste después de eliminar
    let hasNewlineBetween = false;
    const contentBetweenForNewlineCheck: Array<{ index: number, content: any, isNewline: boolean }> = [];

    if (newIndex > originalIndex) {
      const expectedIndexAfterImage = originalIndex + 1;

      // IMPORTANTE: Cuando newIndex === expectedIndexAfterImage (es decir, newIndex === originalIndex + 1),
      // necesitamos verificar el contenido en newIndex mismo, porque el loop no se ejecutará
      // Verificar desde expectedIndexAfterImage hasta newIndex (inclusive)
      for (let i = expectedIndexAfterImage; i <= newIndex; i++) {
        const contentBetween = this.quillInstance.getContents(i, 1);
        if (contentBetween.ops && contentBetween.ops.length > 0) {
          const op = contentBetween.ops[0];
          const isNewline = op.insert === '\n';
          contentBetweenForNewlineCheck.push({
            index: i,
            content: op.insert,
            isNewline
          });

          if (isNewline) {
            hasNewlineBetween = true;
            // NO break aquí, queremos ver todo el contenido
          }
        }
      }

      // También verificar el contenido en el índice objetivo mismo para casos especiales
      // cuando newIndex está justo después de originalIndex
      if (newIndex === expectedIndexAfterImage) {
        const contentAtNewIndex = this.quillInstance.getContents(newIndex, 1);
        const isNewlineAtNewIndex = contentAtNewIndex.ops && contentAtNewIndex.ops.length > 0 && contentAtNewIndex.ops[0].insert === '\n';
        // Si encontramos un newline en newIndex y aún no lo hemos marcado, marcarlo ahora
        if (isNewlineAtNewIndex && !hasNewlineBetween) {
          hasNewlineBetween = true;
        }
      }
    }

    // LÓGICA CORREGIDA: 
    // - Si hay un salto de línea, pasamos el índice original sin ajustar (moveImageInQuill lo ajustará después de eliminar)
    // - Si NO hay salto de línea y newIndex > originalIndex:
    //   * Si newIndex === originalIndex + 1, después de eliminar la imagen en originalIndex,
    //     el contenido que estaba en newIndex ahora está en originalIndex, así que debemos pasar newIndex sin ajustar
    //     y dejar que moveImageInQuill lo maneje correctamente
    //   * Si newIndex > originalIndex + 1, necesitamos ajustar -1 porque después de eliminar,
    //     todos los índices posteriores se desplazan hacia atrás
    // Simplificación: Pasar siempre newIndex y dejar que moveImageInQuill maneje el decremento si es necesario
    const indexToPass = newIndex;

    // Determinar tipo de elemento
    const isVideo = this.selectedElement.classList.contains('ql-video-wrapper');
    const embedType = isVideo ? 'video' : 'image';

    // Asegurar que guardamos los estilos en el StyleManager explícitamente PARA el nuevo src (que es el mismo)
    // Esto es crucial para que restoreCompleteElementSelection encuentre los estilos correctos
    if (this.originalElementDimensions) {
      // console.log('🔍 [MOVE] Saving style to manager explicitly:', this.originalElementDimensions);
      this.styleManager.saveStyle(imageUrl, {
        width: this.originalElementDimensions.width,
        height: this.originalElementDimensions.height,
        style: this.originalElementDimensions.style
      });
    }

    const moveResult = moveImageInQuill(
      this.quillInstance,
      originalIndex,
      indexToPass,
      imageUrl,
      this.originalElementDimensions || undefined,
      hasNewlineBetween,
      embedType
    );



    // Log de la estructura del editor después del movimiento
    if (moveResult) {

      // Seleccionar la imagen en su nueva posición
      // Usar múltiples intentos para encontrar la imagen después de que Quill la haya procesado
      // Seleccionar la imagen en su nueva posición
      // Usar múltiples intentos para encontrar la imagen después de que Quill la haya procesado
      setTimeout(() => {
        // Intentar encontrar la imagen varias veces (Quill puede tardar en actualizar el DOM)
        let attempts = 0;
        const maxAttempts = 10;
        const findImage = () => {
          attempts++;

          const newImage = findResizableElementBySrc(this.editorElement, imageUrl);

          if (newImage) {
            this.selectElement(newImage);
            return;
          } else if (attempts < maxAttempts) {
            setTimeout(findImage, 100);
          } else {
            const allImages = Array.from(this.editorElement.querySelectorAll('img, iframe')) as HTMLElement[];

            if (allImages.length > 0) {
              try {
                const contentAtIndex = this.quillInstance.getContents(newIndex, 1);
                const lastImage = allImages[allImages.length - 1];
                this.selectElement(lastImage);
              } catch (error) {
                if (allImages.length > 0) {
                  const lastImage = allImages[allImages.length - 1];
                  this.selectElement(lastImage);
                }
              }
            }
          }
        };

        findImage();
      }, IMAGE_SELECTION_DELAY);

      this.onElementUpdate();
    }
  }

  private cleanupDrag(): void {
    // console.log('🔍 [DRAG CLEANUP] Cleaning up. isResizing was:', this.isResizing);
    // CRÍTICO: Asegurar que el estado de resize también se limpie
    this.isResizing = false;
    this.isNativeDragActive = false;
    this.lastDragEndTime = Date.now(); // Marcar fin del drag para el cooldown

    // Restaurar el cursor nativo del editor
    this.editorElement.classList.remove('hide-native-cursor');

    // Log del estado del DOM después del drop
    if (this.selectedElement) {
      // console.log('🔍 [DRAG CLEANUP] Element state:', {
      //   tagName: this.selectedElement.tagName,
      //   classList: this.selectedElement.className,
      //   style: this.selectedElement.getAttribute('style'),
      //   hasIframe: this.selectedElement.querySelector('iframe') ? 'YES' : 'NO'
      // });

      // Verificación de integridad estructural para videos
      if (this.selectedElement.classList.contains('ql-video-wrapper')) {
        const iframe = this.selectedElement.querySelector('iframe');
        if (iframe) {
          // console.log('🔍 [DRAG CLEANUP] Video Iframe style:', iframe.getAttribute('style'));
        }
      }
    }

    if (this.selectedElement) {
      finalizeImageDrag(this.selectedElement as any);
      // Restaurar opacidad y cursor
      this.selectedElement.style.opacity = '';
      this.selectedElement.style.cursor = '';
    }

    if (this.dropIndicator) {
      this.dropIndicator.remove();
      this.dropIndicator = null;
    }

    this.observerManager.disconnectAll();
    this.lastDropPosition = null;
    this.originalElementIndex = null;
    this.originalElementDimensions = null;
  }

  destroy(): void {
    this.deselectElement();
    this.cleanupDrag();

    if ((this.editorElement as any)._nativeDragoverHandler) {
      this.editorElement.removeEventListener('dragover', (this.editorElement as any)._nativeDragoverHandler);
      delete (this.editorElement as any)._nativeDragoverHandler;
    }

    this.eventManager.removeAll();
    this.observerManager.disconnectAll();

    if (this.quillTextChangeHandler && this.quillInstance) {
      this.quillInstance.off('text-change', this.quillTextChangeHandler);
    }
    if (this.quillSelectionChangeHandler && this.quillInstance) {
      this.quillInstance.off('selection-change', this.quillSelectionChangeHandler);
    }

    this.handlesPositionThrottle.cancel();
  }
}

