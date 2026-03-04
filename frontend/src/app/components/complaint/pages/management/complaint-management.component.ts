import { Component, signal, inject, viewChild, ChangeDetectionStrategy, computed } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../config/environment';
import { AuthService } from '../../../../services/auth.service';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint } from '../../../../models/app.models';
import { QuillConfigModule } from 'ngx-quill';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideScale, lucideClipboardType, lucideCalendarDays, lucideChevronRight,
  lucideClock, lucidePaperclip, lucideDownload, lucideWrench,
  lucideChevronDown, lucideCheck, lucideTrash2, lucideArrowLeft,
  lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
  selector: 'app-complaint-management',
  imports: [CommonModule, FormsModule, RichTextEditorComponent, NgIconComponent],
  templateUrl: './complaint-management.component.html',
  styleUrl: './complaint-management.component.scss',
  providers: [
    provideIcons({
      lucideScale, lucideClipboardType, lucideCalendarDays, lucideChevronRight,
      lucideClock, lucidePaperclip, lucideDownload, lucideWrench,
      lucideChevronDown, lucideCheck, lucideTrash2, lucideArrowLeft,
      lucideHelpCircle
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintManagementComponent {
  private complaintService = inject(ComplaintService);
  authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  // Computed signal from service
  complaints = computed(() => this.complaintService.complaints());

  selectedComplaint = signal<Complaint | null>(null);
  loading = signal(false);
  submitting = signal(false);

  editor = viewChild(RichTextEditorComponent);

  editData = {
    new_status: '',
    admin_notes: '',
    status_public_description: ''
  };

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'clean']
    ]
  };

  constructor() {
    this.loadComplaints();
  }

  loadComplaints(): void {
    // Check if store already has data? Or always fetch fresh? 
    // Fetching sets the store, so it's safe.
    this.loading.set(true);
    this.complaintService.getAllComplaints().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading complaints:', err);
        this.loading.set(false);
      }
    });
  }

  selectComplaint(c: Complaint): void {
    this.selectedComplaint.set(c);
    this.editData = {
      new_status: c.status,
      admin_notes: c.admin_response || '',
      status_public_description: c.status_public_description || ''
    };
  }

  async updateStatus(): Promise<void> {
    const complaint = this.selectedComplaint();
    if (!complaint) return;

    this.submitting.set(true);

    // Procesar imágenes del editor antes de actualizar
    const editorNode = this.editor();
    if (editorNode) {
      const processedResponse = await editorNode.processImages();
      this.editData.admin_notes = processedResponse;
    }

    const formData = new FormData();
    formData.append('new_status', this.editData.new_status);
    formData.append('admin_notes', this.editData.admin_notes);
    formData.append('status_public_description', this.editData.status_public_description);

    this.complaintService.updateComplaintStatus(complaint.id, formData).subscribe({
      next: (updated) => {
        // No manual update needed, WS handles it. 
        // We might want to update selectedComplaint though if it's the one being viewed?
        // But if we just update the store, the list updates. 
        // selectedComplaint is a separate signal.
        // If we want the detail view to update, we should maybe selecting by ID from the list compute?
        // For now, let's update selectedComplaint manually for immediate feedback or just set it.
        this.selectedComplaint.set(updated);
        this.submitting.set(false);
        alert('Estado actualizado correctamente');
      },
      error: (err) => {
        console.error('Error updating status:', err);
        this.submitting.set(false);
        alert('Error al actualizar el estado');
      }
    });
  }

  deleteComplaint(): void {
    const complaint = this.selectedComplaint();
    if (!complaint) return;

    const confirmMessage = `¿Estás seguro de que deseas eliminar permanentemente la denuncia "${complaint.title}"?\n\nEsta acción eliminará todos los registros, historial y archivos adjuntos del servidor de forma irreversible.`;

    if (confirm(confirmMessage)) {
      this.submitting.set(true);
      this.complaintService.deleteComplaint(complaint.id).subscribe({
        next: () => {
          alert('Denuncia eliminada correctamente');
          this.selectedComplaint.set(null);
          // this.loadComplaints(); // WS Handle
          this.submitting.set(false);
        },
        error: (err) => {
          console.error('Error deleting complaint:', err);
          this.submitting.set(false);
          alert('Error al eliminar la denuncia');
        }
      });
    }
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

  getStatusStripeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'entregada': 'bg-gray-300',
      'pendiente': 'bg-amber-400',
      'en_analisis': 'bg-blue-500',
      'en_investigacion': 'bg-purple-500',
      'informacion_requerida': 'bg-orange-500',
      'resuelta': 'bg-emerald-500',
      'desestimada': 'bg-red-500'
    };
    return classes[status] || 'bg-gray-300';
  }

  getFileUrl(path: string): string {
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

  getSafeHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }
}
