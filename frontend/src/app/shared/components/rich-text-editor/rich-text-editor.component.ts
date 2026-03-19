import { Component, OnDestroy, inject, forwardRef, OnInit, AfterViewInit, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../config/environment';
import { ImageResizeHandler } from './image-resize-handler';
import { ImageStyleManager } from './services/image-style-manager.service';
import {
  applyStylesToQuillElements,
  preserveElementStylesInHTML,
  getElementIndexInQuill,
  findResizableElementBySrc,
  insertImageSafely,
  getQuillSelection,
  createQuillModulesConfig,
  getQuillToolbar,
  registerFontSizeAttributor,
  registerVideoAttributor
} from './utils/quill-utils';
import Quill from 'quill';
import { preserveAllElementStyles } from './utils/image-utils';
import { validateImageFile, normalizeImageUrl, calculateSafeInsertIndex } from './utils/image-upload-utils';
import { IMAGE_SELECTION_DELAY, STYLE_UPDATE_DELAY } from './utils/constants';
import {
  markAllElementsAsResizable,
  unmarkElementAsResizable,
  preserveElementSelectionAfterQuillUpdate,
} from './utils/image-selection-utils';
import { handleError, executeAfterDelay } from './utils/helpers';
import { ConfigService } from '../../../services/config';

export interface QuillModulesConfig {
  toolbar?: any[];
  [key: string]: any;
}

@Component({
  selector: 'app-rich-text-editor',
  imports: [FormsModule, QuillModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true
    }
  ],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RichTextEditorComponent implements OnDestroy, ControlValueAccessor {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  placeholder = input<string>('Escribe aquí...');
  height = input<string>('400px');
  quillModules = input<QuillModulesConfig>(createQuillModulesConfig());
  uploadUrl = input<string>('/upload/image');
  module = input<string>('common');
  entityId = input<string | null>(null);
  variant = input<'classic' | 'glass' | 'dark'>('classic');

  variantClass = computed(() => `editor-variant-${this.variant()}`);

  editorCreated = output<any>();
  contentChange = output<string>();

  content: string = '';
  quillEditor: any = null;
  private imageResizeHandler: ImageResizeHandler | null = null;
  private imageStyleManager = new ImageStyleManager();
  private isUpdatingContent = false;
  private isUserTyping = false;

  constructor() {
    registerFontSizeAttributor(Quill);
    registerVideoAttributor(Quill);
  }

  // ControlValueAccessor implementation
  private onChange = (value: string) => { };
  private onTouched = () => { };

  writeValue(value: string): void {
    const newValue = value || '';

    // If focus is present, we only update if it's a completely different content (not typed)
    const hasFocus = this.quillEditor && this.quillEditor.hasFocus();
    
    // Guard against redundant updates while typing
    if (hasFocus && (this.isUserTyping || newValue === this.content)) {
      return;
    }

    // Normalization check to avoid jumping on minor HTML differences (like spaces vs &nbsp;)
    const currentHTML = this.quillEditor ? this.quillEditor.root.innerHTML : '';
    if (this.quillEditor && this.isSameContent(newValue, currentHTML)) {
      this.content = newValue;
      return;
    }

    if (newValue === this.content) {
      return;
    }

    this.content = newValue;

    if (this.quillEditor) {
      const currentSelection = this.quillEditor.getSelection(false);
      const currentContent = this.quillEditor.root.innerHTML;

      if (newValue !== currentContent) {
        this.isUpdatingContent = true;

        this.quillEditor.root.innerHTML = newValue;

        if (hasFocus && currentSelection && currentSelection.index !== null) {
          // Use longer delay or better strategy for selection restoration
          setTimeout(() => {
            try {
              const length = this.quillEditor.getLength();
              const targetIndex = Math.min(currentSelection.index, Math.max(0, length - 1));
              this.quillEditor.setSelection(targetIndex, currentSelection.length || 0, 'silent');
            } catch (e) {}
          }, 0);
        }

        this.isUpdatingContent = false;
      }
    }
  }

  private isSameContent(html1: string, html2: string): boolean {
    if (html1 === html2) return true;
    if (!html1 || !html2) return html1 === html2;
    
    // Normalize basic differences like &nbsp; vs space and repeated spaces
    const norm = (h: string) => h.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return norm(html1) === norm(html2);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.quillEditor) {
      this.quillEditor.enable(!isDisabled);
    }
  }

  onContentChange(value: string): void {
    if (this.isUpdatingContent) {
      return;
    }

    const hasFocus = this.quillEditor && this.quillEditor.hasFocus();
    if (hasFocus) {
      this.isUserTyping = true;
      // Reset typing status after a delay
      if ((this as any).typingTimeout) clearTimeout((this as any).typingTimeout);
      (this as any).typingTimeout = setTimeout(() => this.isUserTyping = false, 1000);
    }

    if (this.quillEditor) {
      const elements = this.quillEditor.root.querySelectorAll('img, iframe, div.image-resizable, div.ql-video-wrapper');
      const elementStyles = preserveAllElementStyles(elements, this.imageStyleManager, this.quillEditor);

      if (elementStyles.size > 0) {
        value = preserveElementStylesInHTML(value, elementStyles);
        
        // We update this.content but don't emit yet if it hasn't changed meaningfully
      }
    }

    if (value === this.content) {
      return;
    }

    this.content = value;
    this.onChange(value);
    this.onTouched();
    this.contentChange.emit(value);
  }

  onEditorCreated(quill: any): void {
    this.quillEditor = quill;

    if (this.content) {
      this.isUpdatingContent = true;
      quill.root.innerHTML = this.content;
      this.isUpdatingContent = false;

      executeAfterDelay(() => {
        markAllElementsAsResizable(quill.root);
      }, IMAGE_SELECTION_DELAY);
    }

    const toolbar = getQuillToolbar(quill);
    if (toolbar) {
      toolbar.addHandler('image', () => {
        this.handleImageInsertion(quill);
      });

      this.preserveSelectionOnToolbarClick(quill, toolbar);
    }

    // Note: We removed the direct 'text-change' listener to avoid racing with ngx-quill's event
    // and instead handle everything in onContentChange which is fired by the library.

    this.initializeImageResize(quill);

    this.editorCreated.emit(quill);
  }

  private async handleImageInsertion(quill: any): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const validation = validateImageFile(file, {
        maxSizeBytes: this.configService.maxImageSizeBytes,
        allowedTypes: ['image/']
      });
      if (!validation.valid) {
        alert(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64Data = e.target.result;
        const selection = getQuillSelection(quill);
        const insertIndex = calculateSafeInsertIndex(quill, selection?.index);

        if (insertImageSafely(quill, base64Data, insertIndex)) {
          this.finalizeImageInsertion(quill, base64Data, insertIndex);
        } else {
          alert('Error al insertar la imagen en el editor');
        }
      };
      reader.readAsDataURL(file);
    };

    input.click();
  }

  async processImages(): Promise<string> {
    if (!this.quillEditor) return this.content;

    const root = this.quillEditor.root;
    const images = Array.from(root.querySelectorAll('img')) as HTMLElement[];

    const base64Images = images.filter(img => (img as any).src.startsWith('data:image/'));

    if (base64Images.length === 0) {
      return root.innerHTML;
    }

    for (const img of base64Images) {
      try {
        const src = (img as any).src;
        const base64Data = src.split(',')[1];
        const contentType = src.split(',')[0].split(':')[1].split(';')[0];
        const byteCharacters = atob(base64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        const extension = contentType.split('/')[1] || 'png';
        const file = new File([blob], `image.${extension}`, { type: contentType });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', this.module());
        if (this.entityId()) {
          formData.append('entity_id', this.entityId()!);
        }

        const uploadRes = await firstValueFrom(
          this.http.post<{ url: string }>(`${environment.apiUrl}${this.uploadUrl()}`, formData)
        );

        if (uploadRes?.url) {
          const serverUrl = normalizeImageUrl(uploadRes.url);
          (img as any).src = serverUrl;
          img.setAttribute('src', serverUrl);
        }
      } catch (err) {
        console.error('Error al subir imagen base64:', err);
      }
    }

    this.content = root.innerHTML;
    return this.content;
  }

  private finalizeImageInsertion(quill: any, imageUrl: string, insertIndex: number): void {
    executeAfterDelay(() => {
      const elements = Array.from(quill.root.querySelectorAll('img, iframe, div.image-resizable, div.ql-video-wrapper')) as HTMLElement[];
      const insertedElement = elements.find(el => (el as any).src?.includes(imageUrl));

      if (insertedElement) {
        markAllElementsAsResizable(quill.root);
      }

      const newLength = quill.getLength();
      const newIndex = Math.min(insertIndex + 1, Math.max(0, newLength - 1));
      quill.setSelection(newIndex, 'silent');
    }, STYLE_UPDATE_DELAY);
  }

  private preserveSelectionOnToolbarClick(quill: any, toolbar: any): void {
    let savedSelection: { index: number; length: number } | null = null;
    let isToolbarClick = false;

    const toolbarElement = toolbar.container;
    if (!toolbarElement) return;

    const saveSelection = (): void => {
      const currentSelection = quill.getSelection(true);
      if (currentSelection?.length > 0) {
        savedSelection = {
          index: currentSelection.index,
          length: currentSelection.length
        };
      }
    };

    const handleToolbarInteraction = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      const button = target.closest('button, .ql-picker-label, .ql-picker-item');

      if (button && toolbarElement.contains(button)) {
        isToolbarClick = true;
        if (!savedSelection) {
          saveSelection();
        }
      }
    };

    toolbarElement.addEventListener('mousedown', handleToolbarInteraction, true);
    toolbarElement.addEventListener('click', handleToolbarInteraction, true);

    toolbarElement.addEventListener('mousedown', (e: Event) => {
      const target = (e.target as HTMLElement).closest('button, .ql-picker-label, .ql-picker-item');
      if (target && toolbarElement.contains(target)) {
        const selectedImage = this.imageResizeHandler?.getSelectedImage();
        if (selectedImage) {
          const imageIndex = getElementIndexInQuill(quill, quill.root, selectedImage);
          if (imageIndex !== null) {
            quill.setSelection(imageIndex, 1, 'silent');
            savedSelection = { index: imageIndex, length: 1 };
            isToolbarClick = true;

            if (this.imageResizeHandler) {
              (this.imageResizeHandler as any).setApplyingFormat(true);
            }
          }
        }
      }
    }, true);

    const formatButtons = toolbarElement.querySelectorAll('button.ql-align, button.ql-format');
    formatButtons.forEach((button: Element) => {
      button.addEventListener('mousedown', (e: Event) => {
        (e as MouseEvent).stopPropagation();
        saveSelection();

        const selectedImage = this.imageResizeHandler?.getSelectedImage();

        if (selectedImage) {
          const imageIndex = getElementIndexInQuill(quill, quill.root, selectedImage);

          if (imageIndex !== null) {
            quill.setSelection(imageIndex, 1, 'silent');
            savedSelection = { index: imageIndex, length: 1 };
            isToolbarClick = true;
            if (this.imageResizeHandler) {
              (this.imageResizeHandler as any).setApplyingFormat(true);
            }
          }
        }
      }, true);

      button.addEventListener('click', () => {
        const selectedImage = this.imageResizeHandler?.getSelectedImage();
        const imageIndex = selectedImage ? getElementIndexInQuill(quill, quill.root, selectedImage) : null;
        const imageSrc = (selectedImage as any)?.src;

        if (selectedImage && imageIndex !== null && imageSrc) {
          setTimeout(() => {
            const foundImage = findResizableElementBySrc(quill.root, imageSrc);

            if (foundImage) {
              const newImageIndex = getElementIndexInQuill(quill, quill.root, foundImage);

              if (newImageIndex !== null) {
                quill.setSelection(newImageIndex, 1, 'silent');

                const currentImage = this.imageResizeHandler?.getSelectedImage();

                if (!currentImage || (currentImage as any).src !== imageSrc) {
                  if (this.imageResizeHandler) {
                    this.imageResizeHandler.selectElementPublic(foundImage);
                  }
                }

                setTimeout(() => {
                  quill.setSelection(newImageIndex, 1, 'silent');
                }, 10);
              }
            }

            if (this.imageResizeHandler) {
              (this.imageResizeHandler as any).setApplyingFormat(false);
            }

            savedSelection = null;
            isToolbarClick = false;
          }, 100);
        } else if (savedSelection && isToolbarClick) {
          setTimeout(() => {
            quill.setSelection(savedSelection!.index, savedSelection!.length, 'silent');
            savedSelection = null;
            isToolbarClick = false;
          }, 0);
        } else {
          if (this.imageResizeHandler) {
            (this.imageResizeHandler as any).setApplyingFormat(false);
          }
        }
      }, true);
    });

    const originalFormat = quill.format.bind(quill);
    quill.format = (name: string, value: any, source?: string) => {
      if (!isToolbarClick || source !== 'user') {
        isToolbarClick = false;
        savedSelection = null;
        return originalFormat(name, value, source);
      }

      const selectedImage = this.imageResizeHandler?.getSelectedImage();
      const imageSrc = (selectedImage as any)?.src;

      if (selectedImage && imageSrc && (name === 'align' || name === 'block')) {
        const imageIndexBefore = getElementIndexInQuill(quill, quill.root, selectedImage);

        if (imageIndexBefore !== null) {
          quill.setSelection(imageIndexBefore, 1, 'silent');
          savedSelection = { index: imageIndexBefore, length: 1 };
          isToolbarClick = true;

          const result = originalFormat(name, value, source);

          requestAnimationFrame(() => {
            const foundImage = findResizableElementBySrc(quill.root, imageSrc);

            if (foundImage) {
              const imageIndexAfter = getElementIndexInQuill(quill, quill.root, foundImage);

              if (imageIndexAfter !== null) {
                quill.setSelection(imageIndexAfter, 1, 'silent');

                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      const currentImage = this.imageResizeHandler?.getSelectedImage();
                      if (!currentImage || (currentImage as any).src !== imageSrc || !currentImage.isConnected) {
                        if (this.imageResizeHandler) {
                          this.imageResizeHandler.selectElementPublic(foundImage, true);
                        }
                      } else if (currentImage !== foundImage) {
                        if (this.imageResizeHandler) {
                          this.imageResizeHandler.selectElementPublic(foundImage, true);
                        }
                      }

                      const finalSelection = quill.getSelection(true);
                      if (finalSelection && finalSelection.index !== imageIndexAfter) {
                        quill.setSelection(imageIndexAfter, 1, 'silent');
                      }

                      isToolbarClick = false;
                      savedSelection = null;
                    });
                  });
                });
              }
            }
          });

          return result;
        }
      } else if (isToolbarClick && savedSelection && source === 'user') {
        quill.setSelection(savedSelection.index, savedSelection.length, 'silent');
        isToolbarClick = false;
        savedSelection = null;
      }

      const result = originalFormat(name, value, source);

      if (source !== 'user' || !isToolbarClick) {
        isToolbarClick = false;
        savedSelection = null;
      }

      return result;
    };

    const originalFormatText = quill.formatText.bind(quill);
    quill.formatText = (index: number, length: number, formats: any, source?: string) => {
      if (!isToolbarClick || source !== 'user') {
        isToolbarClick = false;
        savedSelection = null;
        return originalFormatText(index, length, formats, source);
      }

      const selectedImage = this.imageResizeHandler?.getSelectedImage();

      if (selectedImage && isToolbarClick && source === 'user') {
        const imageIndex = getElementIndexInQuill(quill, quill.root, selectedImage);

        if (imageIndex !== null) {
          quill.setSelection(imageIndex, 1, 'silent');
          savedSelection = { index: imageIndex, length: 1 };
          const result = originalFormatText(imageIndex, 1, formats, source);
          isToolbarClick = false;
          savedSelection = null;
          return result;
        }
      } else if (isToolbarClick && savedSelection && source === 'user') {
        quill.setSelection(savedSelection.index, savedSelection.length, 'silent');
        const result = originalFormatText(savedSelection.index, savedSelection.length, formats, source);
        isToolbarClick = false;
        savedSelection = null;
        return result;
      }

      isToolbarClick = false;
      savedSelection = null;

      return originalFormatText(index, length, formats, source);
    };
  }


  private initializeImageResize(quill: any): void {
    const editorElement = quill.root;

    if (this.imageResizeHandler) {
      this.imageResizeHandler.destroy();
    }

    // Usar el componente como delegado para eventos
    const componentContext = {
      imageStyleManager: this.imageStyleManager,
      onImageSelected: () => { }, // No necesitamos propagar evento hacia arriba por ahora
      onImageDeselected: () => { }
    };

    // Lazy load del handler para evitar problemas circulares o de inicialización
    this.imageResizeHandler = new ImageResizeHandler(
      editorElement,
      quill,
      () => {
        // Callback para cuando se actualiza un elemento (ej: resize)
        // Podríamos emitir changes aquí si fuera necesario
      },
      this.imageStyleManager
    );
  }

  ngOnDestroy(): void {
    if (this.imageResizeHandler) {
      this.imageResizeHandler.destroy();
    }
  }
}
