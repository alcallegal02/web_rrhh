import { Component, signal, inject, viewChild, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { CopyFieldComponent } from '../../../shared/copy-field/copy-field.component';
import { ComplaintService } from '../../../../services/complaint.service';
import { ConfigService } from '../../../../services/config';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideFilePlus, lucideFolderOpen, lucidePaperclip, lucideFileText,
    lucideX, lucideMail, lucideShieldCheck, lucideSend,
    lucideCheck, lucideAlertOctagon, lucideSearch, lucideTriangleAlert, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-complaint-form',
    imports: [CommonModule, FormsModule, RichTextEditorComponent, CopyFieldComponent, NgIconComponent],
    templateUrl: './complaint-form.component.html',
    styleUrl: './complaint-form.component.scss',
    providers: [
        provideIcons({
            lucideFilePlus, lucideFolderOpen, lucidePaperclip, lucideFileText,
            lucideX, lucideMail, lucideShieldCheck, lucideSend,
            lucideCheck, lucideAlertOctagon, lucideSearch, lucideTriangleAlert, lucideHelpCircle
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintFormComponent {
    private complaintService = inject(ComplaintService);
    private router = inject(Router);
    public configService = inject(ConfigService);

    onSuccessNavigation = output<{ code: string, token: string }>();

    title = signal('');
    description = signal('');
    optionalEmail = signal('');

    selectedFiles = signal<{ file: File, url: string }[]>([]);
    totalSelectedSize = signal(0);
    embeddedImagesSize = signal(0);

    loading = signal(false);
    submitted = signal(false);
    error = signal('');

    // Success State
    complaintCode = signal('');
    complaintToken = signal('');

    editor = viewChild(RichTextEditorComponent);

    quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'font': [] }],
            [{ 'size': ['small', false, 'large', 'huge'] }],
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

    // Files
    onFilesSelected(event: any): void {
        const files: FileList = event.target.files;
        if (files.length > 0) {
            let currentTotalSize = this.totalSelectedSize();
            const newFiles = [...this.selectedFiles()];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const totalWithEmbedded = currentTotalSize + this.embeddedImagesSize();
                if (totalWithEmbedded + file.size > this.configService.maxComplaintPayloadBytes) {
                    this.error.set(`No se pueden añadir más archivos: se superaría el límite global de ${this.configService.limits().maxComplaintPayloadMB}MB.`);
                    break;
                }

                currentTotalSize += file.size;
                newFiles.push({
                    file: file,
                    url: URL.createObjectURL(file)
                });
            }

            this.selectedFiles.set(newFiles);
            this.totalSelectedSize.set(currentTotalSize);
            this.error.set('');
            event.target.value = '';
        }
    }

    removeFile(index: number): void {
        const files = [...this.selectedFiles()];
        const removed = files.splice(index, 1)[0];
        if (removed.url) URL.revokeObjectURL(removed.url);

        this.selectedFiles.set(files);
        this.totalSelectedSize.set(this.totalSelectedSize() - removed.file.size);
        this.error.set('');
    }

    isImage(filename: string): boolean {
        if (!filename) return false;
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
    }

    // Editor
    onEditorContentChange(html: string): void {
        if (!html) {
            this.embeddedImagesSize.set(0);
            return;
        }
        // Simple logic to estimate embedded size
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

    // Submit
    async submitComplaint(): Promise<void> {
        if (this.loading()) return;
        this.loading.set(true);
        this.error.set('');

        const editorNode = this.editor();
        if (editorNode) {
            const processedDescription = await editorNode.processImages();
            this.description.set(processedDescription);
        }

        const formData = new FormData();
        formData.append('title', this.title());
        formData.append('description', this.description());

        if (this.optionalEmail()) {
            formData.append('email', this.optionalEmail());
        }

        if (this.selectedFiles().length > 0) {
            const totalSize = this.totalSelectedSize() + this.embeddedImagesSize();
            if (totalSize > this.configService.maxComplaintPayloadBytes) {
                this.error.set(`El tamaño total supera los ${this.configService.limits().maxComplaintPayloadMB}MB.`);
                this.loading.set(false);
                return;
            }
            this.selectedFiles().forEach(f => formData.append('files', f.file));
        }

        this.complaintService.createComplaint(formData).subscribe({
            next: (response) => {
                this.complaintCode.set(response.code);
                this.complaintToken.set(response.access_token);
                this.submitted.set(true);
                this.loading.set(false);
                this.resetInternalForm();
            },
            error: (err: any) => {
                console.error('ERROR AL ENVIAR DENUNCIA:', err);
                this.handleError(err);
                this.loading.set(false);
            }
        });
    }

    handleError(err: any) {
        if (err.status === 422) {
            this.error.set('Error de validación. Revisa los datos.');
        } else if (err.status === 403) {
            this.error.set(err.error?.detail || 'Acceso bloqueado por seguridad.');
            setTimeout(() => {
                // Handle brute force redirect logic if needed
                const redirectUrl = this.configService.limits().bruteForceRedirectUrl;
                if (redirectUrl) {
                    if (redirectUrl.startsWith('http')) window.location.href = redirectUrl;
                    else this.router.navigate([redirectUrl]);
                }
            }, 5000);
        } else {
            this.error.set(err.error?.detail || 'Error al enviar la denuncia');
        }
    }

    resetInternalForm(): void {
        // Only resets inputs, not the success view state
        this.title.set('');
        this.description.set('');
        this.optionalEmail.set('');
        this.selectedFiles().forEach(f => URL.revokeObjectURL(f.url));
        this.selectedFiles.set([]);
        this.totalSelectedSize.set(0);
    }

    goToStatus(): void {
        this.onSuccessNavigation.emit({
            code: this.complaintCode(),
            token: this.complaintToken()
        });
    }
}
