import { Component, input, output, signal, inject, effect, viewChild, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { NewsService } from '../../../../services/news.service';
import { ConfigService } from '../../../../services/config';
import { environment } from '../../../../config/environment';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucidePencil, lucideImage, lucideChevronDown, lucideFolderOpen,
    lucidePaperclip, lucideFileText, lucideX, lucideLoader2,
    lucideTriangleAlert, lucideCheck, lucideHelpCircle, lucideTrash2, lucidePlus,
    lucideSend, lucideArchive, lucideFileEdit
} from '@ng-icons/lucide';

export interface NewsFormModel {
    id?: string;
    title: string;
    summary: string;
    content: string;
    cover_image_url: string | null;
    status: 'borrador' | 'publicada' | 'archivada';
    publish_date: string | null;
    attachments: { file_url: string; file_original_name: string }[];
    carousel_images: { id?: string; file_url: string; order: number }[];
}

@Component({
    selector: 'app-news-form',
    imports: [FormsModule, RichTextEditorComponent, NgIconComponent, DragDropModule],
    templateUrl: './news-form.component.html',
    styleUrl: './news-form.component.scss',
    providers: [
        provideIcons({
            lucidePencil, lucideImage, lucideChevronDown, lucideFolderOpen,
            lucidePaperclip, lucideFileText, lucideX, lucideLoader2,
            lucideTriangleAlert, lucideCheck, lucideHelpCircle, lucideTrash2, lucidePlus,
            lucideSend, lucideArchive, lucideFileEdit
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsFormComponent {
    private http = inject(HttpClient);
    // private newsService = inject(NewsService); // Not strictly needed if uploads are via http here
    configService = inject(ConfigService);

    initialData = input<NewsFormModel | null>(null);

    save = output<NewsFormModel>();
    cancel = output<void>();

    editor = viewChild<RichTextEditorComponent>(RichTextEditorComponent);

    // Form State
    form = signal<NewsFormModel>({
        title: '',
        summary: '',
        content: '',
        cover_image_url: null,
        status: 'borrador',
        publish_date: '',
        attachments: [],
        carousel_images: []
    });

    // Dropdown States
    statusDropdownOpen = signal(false);

    // Upload State
    uploading = signal(false);
    uploadError = signal('');



    // Generate a temporary ID for new news to keep files organized in their own folder
    private tempId = window.crypto?.randomUUID?.() || `new-${Date.now()}`;
    effectiveFolderId = computed(() => this.form().id || this.tempId);

    pendingAttachments = signal<{ file: File, url: string }[]>([]);
    pendingCoverImage = signal<File | null>(null);
    coverImagePreview = signal<string | null>(null);

    pendingCarouselImages = signal<{ file: File, preview: string }[]>([]);

    totalUploadSize = signal(0);
    embeddedImagesSize = signal(0);

    quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'font': [] }],
            [{ 'size': ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px', '72px', '96px'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'script': 'sub' }, { 'script': 'super' }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'indent': '-1' }, { 'indent': '+1' }],
            [{ 'direction': 'rtl' }],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean'],
            ['blockquote', 'code-block']
        ]
    };

    constructor() {
        effect(() => {
            const init = this.initialData();
            if (init) {
                this.form.set({ ...init });
            } else {
                this.form.set({
                    id: this.tempId,
                    title: '',
                    summary: '',
                    content: '',
                    cover_image_url: null,
                    status: 'borrador',
                    publish_date: '',
                    attachments: [],
                    carousel_images: []
                });
            }

            // Reset buffers
            this.pendingAttachments.set([]);
            this.pendingCarouselImages.set([]);
            this.pendingCoverImage.set(null);
            this.coverImagePreview.set(null);
            this.totalUploadSize.set(0);
            this.uploadError.set('');
            this.uploading.set(false);
            this.statusDropdownOpen.set(false);
        });
    }

    // File Helpers
    getFileUrl(path: string | null | undefined): string {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${environment.apiUrl.replace('/api', '')}${path}`;
    }

    getDownloadUrl(path: string, originalName: string | undefined): string {
        const params = new URLSearchParams();
        params.set('file_path', path);
        if (originalName) {
            params.set('original_name', originalName);
        }
        return `${environment.apiUrl}/upload/download?${params.toString()}`;
    }

    isImage(filename: string): boolean {
        if (!filename) return false;
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
    }

    // Status methods
    toggleStatusDropdown(): void {
        this.statusDropdownOpen.update(v => !v);
    }

    selectStatus(status: 'borrador' | 'publicada' | 'archivada'): void {
        this.updateField('status', status);
        this.statusDropdownOpen.set(false);
    }

    // Cover Image
    onCoverSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        if (file.size > this.configService.maxImageSizeBytes) {
            this.uploadError.set(`La imagen de portada no puede superar los ${this.configService.limits().maxImageSizeMB}MB`);
            return;
        }

        this.pendingCoverImage.set(file);

        const reader = new FileReader();
        reader.onload = () => {
            this.coverImagePreview.set(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    removeCoverImage(event: Event): void {
        event.stopPropagation();
        this.pendingCoverImage.set(null);
        this.coverImagePreview.set(null);
        this.updateField('cover_image_url', null);
    }

    // Carousel Images
    onCarouselSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        this.uploadError.set('');
        const files = Array.from(input.files);

        for (const file of files) {
            if (file.size > this.configService.maxImageSizeBytes) {
                this.uploadError.set(`Una de las imágenes del carrusel supera los ${this.configService.limits().maxImageSizeMB}MB`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = () => {
                this.pendingCarouselImages.update(current => [
                    ...current,
                    { file, preview: reader.result as string }
                ]);
            };
            reader.readAsDataURL(file);
        }
        input.value = '';
    }

  // TODO:
  // - [x] Implement News Image Carousel (User Request)
  //   - [x] Backend: Add NewsCarouselImage model and relationships
  //   - [x] Backend: Update CRUD and Query services
  //   - [x] Frontend: Create ImageCarouselComponent
  //   - [x] Frontend: Manage carousel in NewsForm (Add/Remove/Reorder)
  //       - [x] Manual reordering with arrows
  //       - [x] Drag and Drop reordering with Angular CDK
  //   - [x] Fix persistence and reload issues

    removeExistingCarousel(index: number): void {
        this.form.update(f => {
            const updated = [...f.carousel_images];
            updated.splice(index, 1);
            // Re-order remaining images
            updated.forEach((img, i) => img.order = i);
            return { ...f, carousel_images: updated };
        });
    }

    removePendingCarousel(index: number): void {
        this.pendingCarouselImages.update(current => {
            const updated = [...current];
            updated.splice(index, 1);
            return updated;
        });
    }

    moveCarouselImage(index: number, direction: 'up' | 'down', isPending: boolean): void {
        if (isPending) {
            this.pendingCarouselImages.update(current => {
                const updated = [...current];
                const targetIdx = direction === 'up' ? index - 1 : index + 1;
                if (targetIdx >= 0 && targetIdx < updated.length) {
                    [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
                }
                return updated;
            });
        } else {
            this.form.update(f => {
                const updated = [...f.carousel_images];
                const targetIdx = direction === 'up' ? index - 1 : index + 1;
                if (targetIdx >= 0 && targetIdx < updated.length) {
                    [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
                    // Correct orders
                    updated.forEach((img, i) => img.order = i);
                }
                return { ...f, carousel_images: updated };
            });
        }
    }

    dropExistingCarousel(event: CdkDragDrop<any[]>): void {
        const { previousIndex, currentIndex } = event;
        if (previousIndex === currentIndex) return;
        
        this.form.update(f => {
            // Create deep copy of the array and objects for immutability
            const updated = f.carousel_images.map(img => ({ ...img }));
            
            // Perform explicit swap
            const temp = updated[previousIndex];
            updated[previousIndex] = updated[currentIndex];
            updated[currentIndex] = temp;
            
            // Re-order weights/orders for consistency
            updated.forEach((img, i) => img.order = i);
            
            return { ...f, carousel_images: updated };
        });
    }

    dropPendingCarousel(event: CdkDragDrop<any[]>): void {
        const { previousIndex, currentIndex } = event;
        if (previousIndex === currentIndex) return;
        
        this.pendingCarouselImages.update(current => {
            const updated = [...current];
            // Perform explicit swap
            const temp = updated[previousIndex];
            updated[previousIndex] = updated[currentIndex];
            updated[currentIndex] = temp;
            return updated;
        });
    }

    // Attachments
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        this.uploadError.set('');

        const files = input.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const totalWithEmbedded = this.totalUploadSize() + this.embeddedImagesSize();
            if (totalWithEmbedded + file.size > this.configService.maxNewsPayloadBytes) {
                this.uploadError.set(`El tamaño total de los archivos adjuntos no puede superar los ${this.configService.limits().maxNewsPayloadMB}MB.`);
                continue;
            }
            this.pendingAttachments.update(current => [...current, { file: file, url: URL.createObjectURL(file) }]);
            this.totalUploadSize.update(v => v + file.size);
        }
        input.value = '';
    }

    removePendingFile(index: number): void {
        const files = [...this.pendingAttachments()];
        const removed = files.splice(index, 1)[0];
        if (removed.url) URL.revokeObjectURL(removed.url);
        this.pendingAttachments.set(files);
        this.totalUploadSize.update(v => v - removed.file.size);
    }

    removeExistingFile(index: number): void {
        this.form.update(f => {
            const att = [...f.attachments];
            att.splice(index, 1);
            return { ...f, attachments: att };
        });
    }

    downloadLocalFile(file: File): void {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Editor
    onEditorContentChange(html: string): void {
        if (!html) {
            this.embeddedImagesSize.set(0);
            return;
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const images = doc.querySelectorAll('img');
        let totalSize = 0;
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('data:image')) {
                const base64Data = src.split(',')[1];
                if (base64Data) {
                    totalSize += (base64Data.length * 3) / 4;
                }
            }
        });
        this.embeddedImagesSize.set(totalSize);
    }

    updateField(field: keyof NewsFormModel, value: any) {
        this.form.update(f => ({ ...f, [field]: value }));
    }

    async onSubmit() {
        this.uploading.set(true);
        this.uploadError.set('');

        try {
            const editorNode = this.editor();
            if (editorNode) {
                const processedContent = await editorNode.processImages();
                this.updateField('content', processedContent);
            }

            // Upload Cover
            const coverFile = this.pendingCoverImage();
            if (coverFile) {
                const formData = new FormData();
                formData.append('file', coverFile);
                formData.append('module', 'news');
                formData.append('entity_id', this.effectiveFolderId());
                const res = await firstValueFrom(
                    this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, formData)
                );
                this.updateField('cover_image_url', res.url);
            }

            // Upload Attachments
            const filesToUpload = this.pendingAttachments();
            const newAttachments: { file_url: string; file_original_name: string }[] = [];
            for (const item of filesToUpload) {
                const formData = new FormData();
                formData.append('file', item.file);
                formData.append('module', 'news');
                formData.append('entity_id', this.effectiveFolderId());
                const res = await firstValueFrom(
                    this.http.post<{ url: string, filename: string, original_filename: string }>(
                        `${environment.apiUrl}/upload/document`,
                        formData
                    )
                );
                newAttachments.push({
                    file_url: res.url,
                    file_original_name: res.original_filename
                });
            }

            // Merge attachments
            this.form.update(f => ({
                ...f,
                attachments: [...(f.attachments || []), ...newAttachments]
            }));

            // Upload Carousel Images
            const carouselToUpload = this.pendingCarouselImages();
            const newCarouselImages: { file_url: string; order: number }[] = [];
            
            // Current highest order
            let currentOrder = this.form().carousel_images?.length || 0;

            for (const item of carouselToUpload) {
                const formData = new FormData();
                formData.append('file', item.file);
                formData.append('module', 'news');
                formData.append('entity_id', this.effectiveFolderId());
                const res = await firstValueFrom(
                    this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, formData)
                );
                newCarouselImages.push({
                    file_url: res.url,
                    order: currentOrder++
                });
            }

            this.form.update(f => ({
                ...f,
                carousel_images: [...(f.carousel_images || []), ...newCarouselImages]
            }));


            this.save.emit(this.form());

            // Clear buffers regardless of edit/create mode
            this.pendingAttachments.set([]);
            this.pendingCarouselImages.set([]);
            this.pendingCoverImage.set(null);
            this.coverImagePreview.set(null);
            this.totalUploadSize.set(0);
            this.embeddedImagesSize.set(0);
            this.uploadError.set('');
            this.uploading.set(false);

            // Si es una creación (no hay initialData), limpiamos los campos básicos del formulario manualmente
            if (!this.initialData()) {
                this.tempId = window.crypto?.randomUUID?.() || `new-${Date.now()}`;
                this.form.set({
                    id: this.tempId,
                    title: '',
                    summary: '',
                    content: '',
                    cover_image_url: null,
                    status: 'borrador',
                    publish_date: '',
                    attachments: [],
                    carousel_images: []
                });
            }

        } catch (e: any) {
            this.uploadError.set(e.message || 'Error al subir archivos');
            this.uploading.set(false);
        }
    }
}
