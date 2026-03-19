import { Component, signal, inject, viewChild, ChangeDetectionStrategy, computed } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucideSearch, lucideLock, lucideFileText,
  lucideDownload, lucideCalendar, lucideRefreshCw, lucideShieldCheck,
  lucideScale, lucideInfo, lucideMessageSquare, lucideTriangleAlert,
  lucideShield, lucideSend, lucidePaperclip, lucideX,
  lucideMaximize, lucideCopy, lucideEyeOff, lucideClock, lucidePackageCheck,
  lucideShieldAlert, lucideMessageSquareText, lucideCheckCircle, lucideXCircle
} from '@ng-icons/lucide';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { SafePipe } from '../../../../shared/pipes/safe.pipe';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { FilePreviewModalComponent } from '../../../../shared/components/file-preview-modal/file-preview-modal.component';
import { environment } from '../../../../config/environment';
import { ConfigService } from '../../../../services/config';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint, ComplaintComment } from '../../../../models/app.models';
import { rxResource } from '@angular/core/rxjs-interop';
import { timer, switchMap, of } from 'rxjs';
import * as ComplaintUtils from '../../utils/complaint.utils';

@Component({
  selector: 'app-complaint-status',
  imports: [FormsModule, DatePipe, NgIconComponent, RichTextEditorComponent, FilePreviewModalComponent, StatusBadgeComponent, SafePipe],
  templateUrl: './complaint-status.component.html',
  styleUrl: './complaint-status.component.scss',
  providers: [
    provideIcons({
      lucideArrowLeft, lucideSearch, lucideLock, lucideFileText,
      lucideDownload, lucideCalendar, lucideRefreshCw, lucideShieldCheck,
      lucideScale, lucideInfo, lucideMessageSquare, lucideTriangleAlert,
      lucideShield, lucideSend, lucidePaperclip, lucideX,
      lucideMaximize, lucideCopy, lucideEyeOff
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintStatusComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly configService = inject(ConfigService);
  private readonly complaintService = inject(ComplaintService);

  // --- Estado de búsqueda (parámetros de la query) ---
  code = signal(this.route.snapshot.paramMap.get('code') ?? '');
  token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');

  // Params como señal derivada para el resource
  private readonly queryParams = computed(() => ({
    code: this.code(),
    token: this.token()
  }));

  // --- Resource API: reemplaza el patrón Subscription + OnDestroy + interval ---
  // rxResource gestiona el ciclo de vida automáticamente; el polling de 20s
  // se implementa con timer() como stream reactivo dentro del stream del resource.
  private readonly complaintResource = rxResource({
    params: () => {
      const { code, token } = this.queryParams();
      // Solo lanzar la petición si hay credenciales válidas
      if (!code || !token) return null;
      return { code, token };
    },
    stream: (params: { params: { code: string, token: string } | null }) => {
      if (!params.params) return of(null);
      const { code, token } = params.params;
      // Poll cada 20s: timer(0, 20000) emite inmediatamente y luego cada 20s
      return timer(0, 20_000).pipe(
        switchMap(() => this.complaintService.getComplaintStatus(code, token))
      );
    }
  });

  // Señales derivadas del resource
  readonly complaint = computed(() => this.complaintResource.value() as Complaint | null);
  readonly loading = this.complaintResource.isLoading;
  readonly error = signal('');

  // --- Estado de UI para respuesta ---
  readonly replyContent = signal('');
  readonly selectedFiles = signal<{ file: File; url: string }[]>([]);
  readonly submittingReply = signal(false);
  readonly activePreview = signal<{ url: string; name: string } | null>(null);

  readonly replyEditor = viewChild<RichTextEditorComponent>('replyEditor');

  // Status Utility Mappings (Exposed for template)
  readonly getStatusLabel = ComplaintUtils.getStatusLabel;
  readonly getStatusClass = ComplaintUtils.getStatusClass;
  readonly getStatusVariant = ComplaintUtils.getStatusVariant;
  readonly getStatusIcon = ComplaintUtils.getStatusIcon;

  // --- Acciones ---
  loadComplaint(): void {
    this.complaintResource.reload();
  }

  reset(): void {
    this.code.set('');
    this.token.set('');
    this.error.set('');
    // Al limpiar code/token, el resource deja de hacer peticiones automáticamente
  }

  updateCode(value: string): void { this.code.set(value); }
  updateToken(value: string): void { this.token.set(value); }

  handleSecurityError(msg: string): void {
    this.error.set(msg || 'Acceso bloqueado por seguridad.');
    setTimeout(() => {
      const currentError = this.error().toLowerCase();
      if (currentError.includes('bloquead') || currentError.includes('intentos')) {
        const redirectUrl = this.configService.limits().bruteForceRedirectUrl;
        if (redirectUrl?.startsWith('http')) {
          window.location.href = redirectUrl;
        } else if (redirectUrl) {
          this.router.navigate([redirectUrl]);
        }
      }
    }, 5000);
  }

  goBack(): void { this.router.navigate(['/complaint']); }

  getFileUrl(path: string, downloadName?: string): string {
    if (!path) return '';
    if (path.startsWith('data:')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    let url = `${baseUrl}${path}`;
    if (downloadName) url += `?download=${encodeURIComponent(downloadName)}`;
    return url;
  }

  isImage(filename: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename ?? '');
  }

  onFileSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []) as File[];
    files.forEach(file => {
      if (this.isImage(file.name)) {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) =>
          this.selectedFiles.update(prev => [...prev, { file, url: e.target?.result as string }]);
        reader.readAsDataURL(file);
      } else {
        this.selectedFiles.update(prev => [...prev, { file, url: '' }]);
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  removeFile(index: number): void {
    const fileObj = this.selectedFiles()[index];
    if (fileObj.url?.startsWith('blob:')) URL.revokeObjectURL(fileObj.url);
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  async sendReply(): Promise<void> {
    if (!this.replyContent() || this.submittingReply()) return;
    this.submittingReply.set(true);

    const editorNode = this.replyEditor();
    if (editorNode) {
      this.replyContent.set(await editorNode.processImages());
    }

    this.complaintService.addPublicComment(
      this.code(),
      this.token(),
      this.replyContent(),
      this.selectedFiles().map(f => f.file)
    ).subscribe({
      next: (comment: ComplaintComment) => {
        // Recargar el resource para obtener el estado actualizado
        this.complaintResource.reload();
        this.replyContent.set('');
        this.selectedFiles().forEach(f => { if (f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url); });
        this.selectedFiles.set([]);
        this.submittingReply.set(false);
      },
      error: () => {
        this.error.set('No se pudo enviar la respuesta. Por favor, inténtalo de nuevo.');
        this.submittingReply.set(false);
      }
    });
  }

  openPreview(att: any): void {
    this.activePreview.set({
      url: this.getFileUrl(att.file_url || att.url),
      name: att.file_original_name || att.file?.name || 'Archivo'
    });
  }

  closePreview(): void { this.activePreview.set(null); }
}

// Por qué esta estructura es más escalable:
// rxResource con timer() reemplaza Subscription+OnDestroy+interval, gestionando automáticamente
// el ciclo de vida del polling y evitando memory leaks sin implementar ningún hook de destruction.
