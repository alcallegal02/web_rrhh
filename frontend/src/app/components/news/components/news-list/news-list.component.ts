import { Component, input, output, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../../config/environment';
import { News } from '../../../../models/app.models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileUrlPipe } from '../../../../pipes/file-url.pipe';

@Component({
    selector: 'app-news-list',
    imports: [CommonModule, DatePipe, RouterModule, FileUrlPipe],
    templateUrl: './news-list.component.html',
    styleUrl: './news-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class NewsListComponent {
    newsList = input.required<News[]>();
    canManage = input<boolean>(false); // RRHH/Admin/Superadmin
    layout = input<'grid' | 'list'>('grid');

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
            'borrador': 'bg-gray-100 text-gray-800',
            'publicada': 'bg-green-100 text-green-800',
            'archivada': 'bg-yellow-100 text-yellow-800',
            'eliminada': 'bg-red-100 text-red-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    // Actions
    onStatusChange(id: string, event: Event) {
        const target = event.target as HTMLSelectElement;
        this.statusChange.emit({ id, status: target.value });
    }
}
