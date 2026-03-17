import { Component, signal, inject, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucideSearch, lucideLock, lucideFileText,
  lucideDownload, lucideCalendar, lucideRefreshCw, lucideShieldCheck,
  lucideScale, lucideInfo, lucideMessageSquare, lucideTriangleAlert,
  lucideShield, lucideSend, lucidePaperclip, lucideX
} from '@ng-icons/lucide';
import { RichTextEditorComponent } from '../../../../components/shared/rich-text-editor/rich-text-editor.component';
import { environment } from '../../../../config/environment';
import { ConfigService } from '../../../../services/config';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint } from '../../../../models/app.models';

@Component({
  selector: 'app-complaint-status',
  imports: [CommonModule, FormsModule, DatePipe, NgIconComponent, RichTextEditorComponent],
  templateUrl: './complaint-status.component.html',
  styleUrl: './complaint-status.component.scss',
  providers: [
    provideIcons({
      lucideArrowLeft, lucideSearch, lucideLock, lucideFileText,
      lucideDownload, lucideCalendar, lucideRefreshCw, lucideShieldCheck,
      lucideScale, lucideInfo, lucideMessageSquare, lucideTriangleAlert,
      lucideShield, lucideSend, lucidePaperclip, lucideX
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintStatusComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private configService = inject(ConfigService);
  private complaintService = inject(ComplaintService);

  complaint = signal<Complaint | null>(null);
  code = signal('');
  token = signal('');
  loading = signal(false);
  error = signal('');
  
  // Reply signals
  replyContent = signal('');
  selectedFiles = signal<File[]>([]);
  submittingReply = signal(false);

  replyEditor = viewChild('replyEditor', { read: RichTextEditorComponent });

  constructor() {
    const codeParam = this.route.snapshot.paramMap.get('code');
    const tokenParam = this.route.snapshot.queryParamMap.get('token');

    if (codeParam) {
      this.code.set(codeParam);
    }
    if (tokenParam) {
      this.token.set(tokenParam);
    }

    if (this.code() && this.token()) {
      this.loadComplaint();
    }
  }

  loadComplaint(): void {
    if (!this.code() || !this.token()) return;

    this.loading.set(true);
    this.error.set('');

    this.complaintService.getComplaintStatus(this.code(), this.token()).subscribe({
      next: (data) => {
        this.complaint.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        const errorDetail = err?.error?.detail || 'Error desconocido';
        if (err.status === 403) {
          this.handleSecurityError(errorDetail);
        } else if (err.status === 429) {
          this.error.set(errorDetail || 'Demasiados intentos. Por favor, espera un minuto.');
        } else {
          this.error.set(errorDetail || 'Denuncia no encontrada o clave incorrecta');
        }
        this.complaint.set(null);
        this.loading.set(false);
      }
    });
  }

  handleSecurityError(msg: string) {
    this.error.set(msg || 'Acceso bloqueado por seguridad.');
    setTimeout(() => {
      const currentError = this.error().toLowerCase();
      if (currentError.includes('bloquead') || currentError.includes('intentos')) {
        const redirectUrl = this.configService.limits().bruteForceRedirectUrl;
        if (redirectUrl && redirectUrl.startsWith('http')) {
          window.location.href = redirectUrl;
        } else if (redirectUrl) {
          this.router.navigate([redirectUrl]);
        }
      }
    }, 5000);
  }

  reset(): void {
    this.code.set('');
    this.token.set('');
    this.complaint.set(null);
    this.error.set('');
  }

  updateCode(value: string): void {
    this.code.set(value);
  }

  updateToken(value: string): void {
    this.token.set(value);
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'entregada': 'Entregada',
      'pendiente': 'Pendiente',
      'en_analisis': 'En Análisis',
      'en_investigacion': 'En Investigación',
      'informacion_requerida': 'Información Requerida',
      'resuelta': 'Resuelta',
      'desestimada': 'Desestimada'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'entregada': 'bg-gray-50 text-gray-700 border-gray-200',
      'pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
      'en_analisis': 'bg-blue-50 text-blue-700 border-blue-200',
      'en_investigacion': 'bg-purple-50 text-purple-700 border-purple-200',
      'informacion_requerida': 'bg-orange-50 text-orange-700 border-orange-200',
      'resuelta': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'desestimada': 'bg-red-50 text-red-700 border-red-200'
    };
    return classes[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  }

  goBack(): void {
    this.router.navigate(['/complaint']);
  }

  getSafeHtml(content: string | undefined | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content || '');
  }

  getFileUrl(path: string, originalName: string | undefined): string {
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

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.selectedFiles.update(current => [...current, ...files]);
    }
    // Reset input
    event.target.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  async sendReply(): Promise<void> {
    if (!this.replyContent() || this.submittingReply()) return;

    this.submittingReply.set(true);

    // Procesar imágenes del editor antes de enviar
    const editorNode = this.replyEditor();
    if (editorNode) {
      const processed = await editorNode.processImages();
      this.replyContent.set(processed);
    }

    this.complaintService.addPublicComment(
      this.code(), 
      this.token(), 
      this.replyContent(), 
      this.selectedFiles()
    ).subscribe({
      next: (comment) => {
        // Optimistic update: Add comment to current complaint signal
        const current = this.complaint();
        if (current) {
          this.complaint.set({
            ...current,
            comments: [...(current.comments || []), comment]
          });
        }
        this.replyContent.set('');
        this.selectedFiles.set([]);
        this.submittingReply.set(false);
      },
      error: (err) => {
        console.error('Error sending reply:', err);
        this.error.set('No se pudo enviar la respuesta. Por favor, inténtalo de nuevo.');
        this.submittingReply.set(false);
      }
    });
  }
}
