import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { environment } from '../../../../config/environment';
import { NgIconComponent } from '@ng-icons/core';

export interface DashboardNews {
    title: string;
    summary?: string;
    cover_image_url?: string | null;
    created_at: string;
    [key: string]: any;
}

@Component({
    selector: 'app-news-popup',
    imports: [CommonModule, DatePipe, NgIconComponent],
    templateUrl: './news-popup.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsPopupComponent {
    news = input.required<DashboardNews>();

    close = output<void>();
    readMore = output<void>();

    getFileUrl(path: string | null | undefined): string {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${environment.apiUrl.replace('/api/v1', '')}/${path}`; // Adjusted path normalization
    }
}
