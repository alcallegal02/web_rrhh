import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { environment } from '../../../../config/environment';
import { ConfigService } from '../../../../services/config';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint } from '../../../../models/app.models';

@Component({
  selector: 'app-complaint-status',
  imports: [CommonModule, FormsModule, DatePipe, NgIconComponent],
  templateUrl: './complaint-status.component.html',
  styleUrl: './complaint-status.component.scss',
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
      'entregada': 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm',
      'pendiente': 'px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm',
      'en_analisis': 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm',
      'en_investigacion': 'px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm',
      'informacion_requerida': 'px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm',
      'resuelta': 'px-2 py-1 bg-green-100 text-green-800 rounded text-sm',
      'desestimada': 'px-2 py-1 bg-red-100 text-red-800 rounded text-sm'
    };
    return classes[status] || 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm';
  }

  goBack(): void {
    this.router.navigate(['/complaint']);
  }

  getSafeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
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
}
