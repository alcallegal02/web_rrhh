import { Component, input, output, signal, computed, inject, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideX, lucideDownload, lucideMaximize, lucideMinimize, lucideFileText } from '@ng-icons/lucide';

@Component({
  selector: 'app-file-preview-modal',
  imports: [NgIconComponent],
  templateUrl: './file-preview-modal.component.html',
  styleUrl: './file-preview-modal.component.css',
  providers: [
    provideIcons({ lucideX, lucideDownload, lucideMaximize, lucideMinimize, lucideFileText })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilePreviewModalComponent {
  private sanitizer = inject(DomSanitizer);

  fileUrl = input.required<string>();
  fileName = input.required<string>();
  
  close = output();

  isImage = computed(() => {
    const url = this.fileUrl().toLowerCase();
    return url.includes('data:image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  });

  isPdf = computed(() => {
    const url = this.fileUrl().toLowerCase();
    return url.includes('application/pdf') || url.endsWith('.pdf');
  });

  safePdfUrl = computed(() => {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.fileUrl());
  });

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.close.emit();
    }
  }
}
