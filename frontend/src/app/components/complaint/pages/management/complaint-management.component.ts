import { Component, signal, inject, viewChild, ChangeDetectionStrategy, computed, HostListener } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import * as ComplaintUtils from '../../utils/complaint.utils';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../config/environment';
import { AuthService } from '../../../../services/auth.service';
import { FilePreviewModalComponent } from '../../../../shared/components/file-preview-modal/file-preview-modal.component';
import { RichTextEditorComponent } from '../../../../shared/components/rich-text-editor/rich-text-editor.component';
import { ComplaintService } from '../../../../services/complaint.service';
import { Complaint } from '../../../../models/app.models';
import { ComplaintListComponent } from '../../components/complaint-list/complaint-list.component';
import { DialogService } from '../../../../services/dialog.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideScale, lucideClipboardType, lucideCalendarDays, lucideChevronRight,
  lucideClock, lucidePaperclip, lucideDownload, lucideWrench,
  lucideChevronDown, lucideCheck, lucideTrash2, lucideArrowLeft,
  lucideHelpCircle, lucideMessageCircle, lucideUser, lucideShield,
  lucideSend, lucideLock, lucideFileText, lucideX, lucideFilter,
  lucideSearch, lucideShieldAlert, lucideMessageSquareText, lucideCheckCircle,
  lucideXCircle, lucidePackageCheck,
  lucideMaximize, lucideCopy, lucideEyeOff
} from '@ng-icons/lucide';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { FileUploaderComponent, SelectedFile } from '../../../../shared/components/file-uploader/file-uploader.component';
import { SafePipe } from '../../../../shared/pipes/safe.pipe';

@Component({
  selector: 'app-complaint-management',
  imports: [
    FormsModule, 
    RichTextEditorComponent, 
    NgIconComponent, 
    ComplaintListComponent, 
    FilePreviewModalComponent,
    StatusBadgeComponent,
    FileUploaderComponent,
    DatePipe,
    SafePipe
  ],
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
      lucideXCircle, lucidePackageCheck,
      lucideMaximize, lucideCopy, lucideEyeOff
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintManagementComponent {
  private readonly complaintService = inject(ComplaintService);
  readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly dialogService = inject(DialogService);

  // Filters
  readonly filterStatus = signal<string[]>([]);
  readonly filterStartDate = signal<string>('');
  readonly filterEndDate = signal<string>('');

  readonly statusOptions = ComplaintUtils.COMPLAINT_STATUS_OPTIONS;

  // Data fetching using rxResource
  readonly complaintsResource = rxResource<Complaint[], unknown>({
    stream: () => this.complaintService.getAllComplaints()
  });

  // UI state
  readonly activeStatusDropdown = signal(false);

  @HostListener('document:click')
  closeDropdowns() {
    this.activeStatusDropdown.set(false);
  }

  // Status Utility Mappings (Exposed for template)
  readonly getStatusIcon = ComplaintUtils.getStatusIcon;
  readonly getStatusIconColor = ComplaintUtils.getStatusIconColor;
  readonly getStatusLabel = ComplaintUtils.getStatusLabel;
  readonly getStatusVariant = ComplaintUtils.getStatusVariant;
  readonly getStatusClass = ComplaintUtils.getStatusClass;
  readonly getStatusStripeClass = ComplaintUtils.getStatusStripeClass;

  // Computed signal from service store with filtering
  readonly complaints = computed(() => {
    // We use the central store via the service because the WS updates the store
    let items = this.complaintService.complaints();
    
    if (this.filterStatus().length > 0) {
      items = items.filter(c => this.filterStatus().includes(c.status));
    }
    
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

  readonly selectedComplaintId = signal<string | null>(null);
  readonly selectedComplaint = computed(() => {
    const id = this.selectedComplaintId();
    if (!id) return null;
    return this.complaints().find(c => c.id === id) || null;
  });

  readonly loading = computed(() => this.complaintsResource.isLoading());
  readonly submitting = signal(false);

  // Management UI signals
  readonly activeTab = signal<'public' | 'internal'>('public');
  readonly adminCommentContent = signal('');
  readonly adminSelectedFiles = signal<{ file: File, url: string }[]>([]);
  readonly activePreview = signal<{ url: string, name: string } | null>(null);

  readonly commentEditor = viewChild('commentEditor', { read: RichTextEditorComponent });

  readonly publicComments = computed(() => {
    const selected = this.selectedComplaint();
    return selected?.comments?.filter(c => c.is_public) || [];
  });

  readonly internalComments = computed(() => {
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
    this.activeStatusDropdown.update(v => !v);
  }

  async changeStatusQuickly(newStatus: string): Promise<void> {
    const complaint = this.selectedComplaint();
    if (!complaint || complaint.status === newStatus) return;
    
    this.editData.new_status = newStatus;
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
      next: () => this.submitting.set(false),
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
      next: () => this.submitting.set(false),
      error: (err) => {
        console.error('Error updating status:', err);
        this.submitting.set(false);
        alert('Error al actualizar el estado');
      }
    });
  }

  async deleteComplaint(): Promise<void> {
    const complaint = this.selectedComplaint();
    if (!complaint) return;

    const confirmed = await this.dialogService.danger(
      'Eliminar Denuncia',
      `¿Estás seguro de que deseas eliminar permanentemente la denuncia "${complaint.title}"? Esta acción es irreversible.`
    );

    if (confirmed) {
      this.submitting.set(true);
      this.complaintService.deleteComplaint(complaint.id).subscribe({
        next: () => {
          this.selectedComplaintId.set(null);
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


  onFilesChanged(files: SelectedFile[]): void {
    this.adminSelectedFiles.set(files);
  }

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      files.forEach(file => {
        if (this.isImage(file.name)) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.adminSelectedFiles.update(prev => [...prev, {
              file: file,
              url: e.target.result as string
            }]);
          };
          reader.readAsDataURL(file);
        } else {
          this.adminSelectedFiles.update(prev => [...prev, {
            file: file,
            url: ''
          }]);
        }
      });
    }
    event.target.value = '';
  }

  removeFile(index: number): void {
    const fileObj = this.adminSelectedFiles()[index];
    if (fileObj.url && typeof fileObj.url === 'string' && fileObj.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileObj.url);
    }
    this.adminSelectedFiles.update(files => files.filter((_, i) => i !== index));
  }

  async sendAdminComment(): Promise<void> {
    const complaintId = this.selectedComplaintId();
    if (!complaintId || !this.adminCommentContent() || this.submitting()) return;

    this.submitting.set(true);

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
      this.adminSelectedFiles().map(f => f.file)
    ).subscribe({
      next: () => {
        this.adminCommentContent.set('');
        this.adminSelectedFiles().forEach(f => {
          if (f.url && typeof f.url === 'string' && f.url.startsWith('blob:')) {
            URL.revokeObjectURL(f.url);
          }
        });
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
    this.filterStatus.update(current => 
      current.includes(status) ? current.filter(s => s !== status) : [...current, status]
    );
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

  isImage(filename: string): boolean {
    if (!filename) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
  }

  getFileUrl(path: string, downloadName?: string): string {
    if (!path) return '';
    if (path.startsWith('data:')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    let url = `${baseUrl}${path}`;
    if (downloadName) {
      url += `?download=${encodeURIComponent(downloadName)}`;
    }
    return url;
  }

  openPreview(att: any): void {
    this.activePreview.set({
      url: this.getFileUrl(att.file_url || att.url),
      name: att.file_original_name || att.file?.name || 'Archivo'
    });
  }

  closePreview(): void {
    this.activePreview.set(null);
  }
}
