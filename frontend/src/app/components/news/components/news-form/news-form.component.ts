import { Component, input, output, signal, inject, effect, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { NewsService } from '../../../../services/news.service';
import { ConfigService } from '../../../../services/config';
import { environment } from '../../../../config/environment';
import { NgIconComponent } from '@ng-icons/core';

export interface NewsFormModel {
    id?: string;
    title: string;
    summary: string;
    content: string;
    cover_image_url: string;
    status: 'borrador' | 'publicada' | 'archivada';
    publish_date: string;
    attachments: { file_url: string; file_original_name: string }[];
}

@Component({
    selector: 'app-news-form',
    imports: [CommonModule, FormsModule, RichTextEditorComponent, NgIconComponent],
    templateUrl: './news-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsFormComponent {
    private http = inject(HttpClient);
    // private newsService = inject(NewsService); // Not strictly needed if uploads are via http here
    configService = inject(ConfigService);

    initialData = input<NewsFormModel | null>(null);

    save = output<NewsFormModel>();
    cancel = output<void>();

    editor = viewChild(RichTextEditorComponent);

    // Form State
    form = signal<NewsFormModel>({
        title: '',
        summary: '',
        content: '',
        cover_image_url: '',
        status: 'borrador',
        publish_date: '',
        attachments: []
    });

    // Upload State
    uploading = signal(false);
    uploadError = signal('');

    pendingAttachments = signal<{ file: File, url: string }[]>([]);
    pendingCoverImage = signal<File | null>(null);
    coverImagePreview = signal<string | null>(null);

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
                    title: '',
                    summary: '',
                    content: '',
                    cover_image_url: '',
                    status: 'borrador',
                    publish_date: '',
                    attachments: []
                });
            }

            // Reset buffers
            this.pendingAttachments.set([]);
            this.pendingCoverImage.set(null);
            this.coverImagePreview.set(null);
            this.totalUploadSize.set(0);
            this.uploadError.set('');
            this.uploading.set(false);
        });
    }

    // File Helpers
    getFileUrl(path: string | undefined): string {
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
                const res = await firstValueFrom(
                    this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?module=news`, formData)
                );
                this.updateField('cover_image_url', res.url);
            }

            // Upload Attachments
            const filesToUpload = this.pendingAttachments();
            const newAttachments: { file_url: string; file_original_name: string }[] = [];
            for (const item of filesToUpload) {
                const formData = new FormData();
                formData.append('file', item.file);
                const res = await firstValueFrom(
                    this.http.post<{ url: string, filename: string, original_filename: string }>(
                        `${environment.apiUrl}/upload/document?module=news`,
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


            this.save.emit(this.form());

        } catch (e: any) {
            this.uploadError.set(e.message || 'Error al subir archivos');
            this.uploading.set(false);
        }
    }
}
