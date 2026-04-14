import { Component, signal, inject, viewChild, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { CopyFieldComponent } from '../../../../shared/components/copy-field/copy-field.component';
import { ComplaintService } from '../../../../services/complaint.service';
import { ConfigService } from '../../../../services/config';
import { FileUploaderComponent, SelectedFile } from '../../../../shared/components/file-uploader/file-uploader.component';
import { COMPLAINT_STATUS_OPTIONS, calculateEmbeddedImagesSize } from '../../utils/complaint.utils';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideFilePlus, lucideFolderOpen, lucidePaperclip, lucideFileText,
    lucideX, lucideMail, lucideShieldCheck, lucideSend,
    lucideCheck, lucideAlertOctagon, lucideSearch, lucideTriangleAlert, lucideHelpCircle,
    lucideCopy, lucideEyeOff
} from '@ng-icons/lucide';

@Component({
    selector: 'app-complaint-form',
    imports: [FormsModule, RichTextEditorComponent, CopyFieldComponent, NgIconComponent, FileUploaderComponent],
    templateUrl: './complaint-form.component.html',
    styleUrl: './complaint-form.component.scss',
    providers: [
        provideIcons({
            lucideFilePlus, lucideFolderOpen, lucidePaperclip, lucideFileText,
            lucideX, lucideMail, lucideShieldCheck, lucideSend,
            lucideCheck, lucideAlertOctagon, lucideSearch, lucideTriangleAlert, lucideHelpCircle,
            lucideCopy, lucideEyeOff
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintFormComponent {
    private complaintService = inject(ComplaintService);
    private sanitizer = inject(DomSanitizer);
    private router = inject(Router);
    public configService = inject(ConfigService);

    onSuccessNavigation = output<{ code: string, token: string }>();

    title = signal('');
    description = signal('');
    optionalEmail = signal('');

    selectedFiles = signal<SelectedFile[]>([]);
    embeddedImagesSize = signal(0);

    loading = signal(false);
    submitted = signal(false);
    error = signal('');
    // Touched states for validation feedback
    titleTouched = signal(false);
    descriptionTouched = signal(false);
    emailTouched = signal(false);

    // Form State & Validation (Signal-based)
    isTitleValid = computed(() => this.title().trim().length >= 5);
    isDescriptionValid = computed(() => this.description().trim().length >= 20);
    isEmailValid = computed(() => {
        const email = this.optionalEmail().trim();
        if (!email) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    });
    isFormValid = computed(() => this.isTitleValid() && this.isDescriptionValid() && this.isEmailValid() && !this.loading());

    // Success State
    complaintCode = signal('');
    complaintToken = signal('');

    editor = viewChild<RichTextEditorComponent>(RichTextEditorComponent);

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

    // Editor
    onEditorContentChange(html: string): void {
        this.embeddedImagesSize.set(calculateEmbeddedImagesSize(html));
    }

    getTotalFileSize(): number {
        return this.selectedFiles().reduce((acc, f) => acc + f.file.size, 0);
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
            const totalSize = this.getTotalFileSize() + this.embeddedImagesSize();
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
        this.title.set('');
        this.description.set('');
        this.optionalEmail.set('');
        this.selectedFiles.set([]);
    }

    goToStatus(): void {
        this.onSuccessNavigation.emit({
            code: this.complaintCode(),
            token: this.complaintToken()
        });
    }
}
