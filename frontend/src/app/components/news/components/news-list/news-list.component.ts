import { Component, input, output, inject, ChangeDetectionStrategy, ViewEncapsulation, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../../config/environment';
import { News } from '../../../../models/app.models';
import { HostListener } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileUrlPipe } from '../../../../pipes/file-url.pipe';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideNewspaper, lucidePencil, lucideTrash2, lucideChevronRight,
    lucidePaperclip, lucideCalendarDays, lucideSend, lucideFileEdit, lucideArchive,
    lucideChevronDown
} from '@ng-icons/lucide';

@Component({
    selector: 'app-news-list',
    imports: [CommonModule, DatePipe, RouterModule, FileUrlPipe, NgIconComponent],
    templateUrl: './news-list.component.html',
    styleUrl: './news-list.component.scss',
    providers: [
        provideIcons({ lucideNewspaper, lucidePencil, lucideTrash2, lucideChevronRight, lucidePaperclip, lucideCalendarDays, lucideSend, lucideFileEdit, lucideArchive, lucideChevronDown })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class NewsListComponent {
    newsList = input.required<News[]>();
    canManage = input<boolean>(false); // RRHH/Admin/Superadmin
    layout = input<'grid' | 'list' | 'sidebar'>('sidebar');
    editingId = input<string | null>(null);

    statusOptions = [
        { value: 'borrador', label: 'Borrador', icon: 'lucideFileEdit' },
        { value: 'publicada', label: 'Publicar', icon: 'lucideSend' },
        { value: 'archivada', label: 'Archivar', icon: 'lucideArchive' }
    ];

    // Custom Dropdown State
    activeDropdownId = signal<string | null>(null);

    edit = output<News>();
    delete = output<string>();
    statusChange = output<{ id: string, status: string }>();

    private sanitizer = inject(DomSanitizer);
    private router = inject(Router);

    // Expanded logic removed in favor of detail view navigation

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

    getSafeHtml(content: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(content);
    }

    goToDetail(id: string): void {
        this.router.navigate(['/news', id]);
    }

    // Status Helpers
    getStatusLabel(status: string): string {
        const labels: { [key: string]: string } = {
            'borrador': 'Borrador',
            'publicada': 'Publicada',
            'archivada': 'Archivada',
            'eliminada': 'Eliminada'
        };
        return labels[status] || status;
    }

    getStatusClass(status: string): string {
        const classes: { [key: string]: string } = {
            'borrador': 'bg-gray-50 text-gray-500 border-gray-200',
            'publicada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'archivada': 'bg-amber-50 text-amber-700 border-amber-200',
            'eliminada': 'bg-red-50 text-red-700 border-red-200'
        };
        return classes[status] || 'bg-gray-50 text-gray-500 border-gray-200';
    }

    getStatusIcon(status: string): string {
        const icons: { [key: string]: string } = {
            'borrador': 'lucideFileEdit',
            'publicada': 'lucideSend',
            'archivada': 'lucideArchive',
            'eliminada': 'lucideTrash2'
        };
        return icons[status] || 'lucideNewspaper';
    }

    // Actions
    onStatusChange(id: string, event: Event) {
        const target = event.target as HTMLSelectElement;
        this.statusChange.emit({ id, status: target.value });
    }

    toggleDropdown(id: string, event: Event): void {
        event.stopPropagation();
        this.activeDropdownId.update(current => current === id ? null : id);
    }

    @HostListener('document:click')
    closeAllDropdowns(): void {
        this.activeDropdownId.set(null);
    }

    selectStatus(id: string, status: string, event: Event): void {
        event.stopPropagation();
        this.statusChange.emit({ id, status });
        this.activeDropdownId.set(null);
    }
}
