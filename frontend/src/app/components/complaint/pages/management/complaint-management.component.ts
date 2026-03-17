import { Component, signal, inject, viewChild, ChangeDetectionStrategy, computed, HostListener } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../config/environment';
import { AuthService } from '../../../../services/auth.service';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint } from '../../../../models/app.models';
import { ComplaintListComponent } from '../../components/complaint-list/complaint-list.component';
import { QuillConfigModule } from 'ngx-quill';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideScale, lucideClipboardType, lucideCalendarDays, lucideChevronRight,
  lucideClock, lucidePaperclip, lucideDownload, lucideWrench,
  lucideChevronDown, lucideCheck, lucideTrash2, lucideArrowLeft,
  lucideHelpCircle, lucideMessageCircle, lucideUser, lucideShield,
  lucideSend, lucideLock, lucideFileText, lucideX, lucideFilter,
  lucideSearch, lucideShieldAlert, lucideMessageSquareText, lucideCheckCircle,
  lucideXCircle, lucidePackageCheck
} from '@ng-icons/lucide';

@Component({
  selector: 'app-complaint-management',
  imports: [CommonModule, FormsModule, RichTextEditorComponent, NgIcon, ComplaintListComponent],
  templateUrl: './complaint-management.component.html',
  styleUrl: './complaint-management.component.scss',
  providers: [
    provideIcons({
      lucideScale, lucideClipboardType, lucideCalendarDays, lucideChevronRight,
      lucideClock, lucidePaperclip, lucideDownload, lucideWrench,
      lucideChevronDown, lucideCheck, lucideTrash2, lucideArrowLeft,
      lucideHelpCircle, lucideMessageCircle, lucideUser, lucideShield,
      lucideSend, lucideLock, lucideFileText, lucideX, lucideFilter,
      lucideSearch, lucideShieldAlert, lucideMessageSquareText, lucideCheckCircle,
      lucideXCircle, lucidePackageCheck
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintManagementComponent {
  private complaintService = inject(ComplaintService);
  authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  // Filters
  filterStatus = signal<string[]>([]);
  filterStartDate = signal<string>('');
  filterEndDate = signal<string>('');

  statusOptions = [
    { value: 'entregada', label: 'Entregada', icon: 'lucidePackageCheck', iconColor: 'text-gray-400' },
    { value: 'pendiente', label: 'Pendiente', icon: 'lucideClock', iconColor: 'text-amber-500' },
    { value: 'en_analisis', label: 'En Análisis', icon: 'lucideSearch', iconColor: 'text-blue-500' },
    { value: 'en_investigacion', label: 'En Investigación', icon: 'lucideShieldAlert', iconColor: 'text-purple-500' },
    { value: 'informacion_requerida', label: 'Info. Requerida', icon: 'lucideMessageSquareText', iconColor: 'text-orange-500' },
    { value: 'resuelta', label: 'Resuelta', icon: 'lucideCheckCircle', iconColor: 'text-emerald-500' },
    { value: 'desestimada', label: 'Desestimada', icon: 'lucideXCircle', iconColor: 'text-red-500' }
  ];

  // UI state
  activeStatusDropdown = signal(false);

  @HostListener('document:click')
  closeDropdowns() {
    this.activeStatusDropdown.set(false);
  }

  getStatusIcon(status: string): string {
    return this.statusOptions.find(opt => opt.value === status)?.icon || 'lucideScale';
  }

  getStatusIconColor(status: string): string {
    return this.statusOptions.find(opt => opt.value === status)?.iconColor || 'text-gray-400';
  }

  // Computed signal from service with filtering
  complaints = computed(() => {
    let items = this.complaintService.complaints();
    
    // Filter by status
    if (this.filterStatus().length > 0) {
      items = items.filter(c => this.filterStatus().includes(c.status));
    }
    
    // Filter by date
    if (this.filterStartDate()) {
      const start = new Date(this.filterStartDate());
      items = items.filter(c => new Date(c.created_at) >= start);
    }
    
    if (this.filterEndDate()) {
      const end = new Date(this.filterEndDate());
      end.setHours(23, 59, 59, 999);
      items = items.filter(c => new Date(c.created_at) <= end);
    }
    
    return items;
  });

  selectedComplaintId = signal<string | null>(null);
  selectedComplaint = computed(() => {
    const id = this.selectedComplaintId();
    if (!id) return null;
    return this.complaints().find(c => c.id === id) || null;
  });

  loading = signal(false);
  submitting = signal(false);

  // Management UI signals
  activeTab = signal<'public' | 'internal'>('public');
  adminCommentContent = signal('');
  adminSelectedFiles = signal<File[]>([]);

  commentEditor = viewChild('commentEditor', { read: RichTextEditorComponent });

  publicComments = computed(() => {
    const selected = this.selectedComplaint();
    return selected?.comments?.filter(c => c.is_public) || [];
  });

  internalComments = computed(() => {
    const selected = this.selectedComplaint();
    return selected?.comments?.filter(c => !c.is_public) || [];
  });

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
    this.selectedComplaintId.set(c.id);
    this.editData = {
      new_status: c.status,
      admin_notes: c.admin_response || '',
      status_public_description: c.status_public_description || ''
    };
    this.activeTab.set('public');
    this.activeStatusDropdown.set(false);
  }

  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.activeStatusDropdown.set(!this.activeStatusDropdown());
  }

  async changeStatusQuickly(newStatus: string): Promise<void> {
    const complaint = this.selectedComplaint();
    if (!complaint || complaint.status === newStatus) return;
    
    this.editData.new_status = newStatus;
    // When changing quickly, we don't want to overwrite existing notes/desc if we are not editing them
    // But the backend endpoint expects them. We'll send the current ones from selectedComplaint.
    this.editData.admin_notes = complaint.admin_response || '';
    this.editData.status_public_description = complaint.status_public_description || '';
    
    await this.updateStatus();
    this.activeStatusDropdown.set(false);
  }

  async changeStatusFromList(event: { complaintId: string, newStatus: string }): Promise<void> {
    const complaint = this.complaints().find(c => c.id === event.complaintId);
    if (!complaint || complaint.status === event.newStatus) return;

    this.submitting.set(true);

    const formData = new FormData();
    formData.append('new_status', event.newStatus);
    formData.append('admin_notes', complaint.admin_response || '');
    formData.append('status_public_description', complaint.status_public_description || '');

    this.complaintService.updateComplaintStatus(event.complaintId, formData).subscribe({
      next: () => {
        this.submitting.set(false);
      },
      error: (err) => {
        console.error('Error updating status from list:', err);
        this.submitting.set(false);
        alert('Error al actualizar el estado desde el listado');
      }
    });
  }

  async updateStatus(): Promise<void> {
    const complaint = this.selectedComplaint();
    if (!complaint) return;

    this.submitting.set(true);

    const formData = new FormData();
    formData.append('new_status', this.editData.new_status);
    formData.append('admin_notes', this.editData.admin_notes);
    formData.append('status_public_description', this.editData.status_public_description);

    this.complaintService.updateComplaintStatus(complaint.id, formData).subscribe({
      next: (updated) => {
        this.submitting.set(false);
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
          this.selectedComplaintId.set(null);
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

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.adminSelectedFiles.update(current => [...current, ...files]);
    }
    event.target.value = '';
  }

  removeFile(index: number): void {
    this.adminSelectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  async sendAdminComment(): Promise<void> {
    const complaintId = this.selectedComplaintId();
    if (!complaintId || !this.adminCommentContent() || this.submitting()) return;

    this.submitting.set(true);

    // Procesar imágenes del editor de comentarios
    const editorNode = this.commentEditor();
    if (editorNode) {
      const processed = await editorNode.processImages();
      this.adminCommentContent.set(processed);
    }

    const isPublic = this.activeTab() === 'public';

    this.complaintService.addAdminComment(
      complaintId, 
      this.adminCommentContent(), 
      isPublic,
      this.adminSelectedFiles()
    ).subscribe({
      next: (comment) => {
        // WS will handle the list update
        this.adminCommentContent.set('');
        this.adminSelectedFiles.set([]);
        this.submitting.set(false);
      },
      error: (err) => {
        console.error('Error sending admin comment:', err);
        this.submitting.set(false);
        alert('Error al enviar el comentario');
      }
    });
  }

  // --- Filter Actions ---
  toggleFilterStatus(status: string): void {
    this.filterStatus.update(current => {
      if (current.includes(status)) {
        return current.filter(s => s !== status);
      } else {
        return [...current, status];
      }
    });
  }

  isFilterStatusSelected(status: string): boolean {
    return this.filterStatus().includes(status);
  }

  setFilterStartDate(date: string): void {
    this.filterStartDate.set(date);
  }

  setFilterEndDate(date: string): void {
    this.filterEndDate.set(date);
  }

  clearFilters(): void {
    this.filterStatus.set([]);
    this.filterStartDate.set('');
    this.filterEndDate.set('');
  }
}
