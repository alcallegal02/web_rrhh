import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NewsService } from '../../../../services/news.service';
import { WebSocketService, WebSocketMessage } from '../../../../services/websocket.service';
import { AuthService } from '../../../../services/auth.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { NewsListComponent } from '../news-list/news-list.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { 
    lucideFilter, 
    lucideFileEdit, 
    lucideSend, 
    lucideArchive, 
    lucideCalendar, 
    lucideSettings, 
    lucideNewspaper,
    lucideX
} from '@ng-icons/lucide';

@Component({
    selector: 'app-news-archive',
    imports: [NewsListComponent, RouterModule, NgIconComponent],
    providers: [
        provideIcons({ 
            lucideFilter, 
            lucideFileEdit, 
            lucideSend, 
            lucideArchive, 
            lucideCalendar, 
            lucideSettings, 
            lucideNewspaper,
            lucideX
        })
    ],
    templateUrl: './news-archive.component.html',
    styleUrl: './news-archive.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsArchiveComponent {
    private newsService = inject(NewsService);
    readonly authService = inject(AuthService);
    private wsService = inject(WebSocketService);

    statusOptions = [
        { value: 'borrador', label: 'Borrador', icon: 'lucideFileEdit' },
        { value: 'publicada', label: 'Publicada', icon: 'lucideSend' },
        { value: 'archivada', label: 'Archivada', icon: 'lucideArchive' }
    ];

    // Filters
    filterStatus = signal<string[]>([]);
    startDate = signal<string>('');
    endDate = signal<string>('');

    newsResource = rxResource({
        params: () => ({
            // If admin and no filter, show everything. If user, only published.
            status: this.filterStatus().length > 0 ? this.filterStatus() : (this.isAdminUser() ? undefined : ['publicada']),
            start: this.startDate() || undefined,
            end: this.endDate() || undefined
        }),
        stream: ({ params }) => this.newsService.getAllNews(100, 0, params.status, params.start, params.end)
    });

    newsItems = computed(() => {
        const items = this.newsResource.value() || [];
        return [...items].sort((a, b) => {
            const dateA = new Date(a.publish_date || a.created_at).getTime();
            const dateB = new Date(b.publish_date || b.created_at).getTime();
            return dateB - dateA;
        });
    });

    isAdminUser(): boolean {
        return this.authService.isRRHH() || this.authService.isSuperadmin() || this.authService.isAdmin();
    }

    toggleStatus(status: string) {
        this.filterStatus.update(curr => curr.includes(status) ? curr.filter(s => s !== status) : [...curr, status]);
    }

    isSelected(status: string) {
        return this.filterStatus().includes(status);
    }

    setStartDate(date: string) { this.startDate.set(date); }
    setEndDate(date: string) { this.endDate.set(date); }

    clearFilters() {
        this.filterStatus.set([]);
        this.startDate.set('');
        this.endDate.set('');
    }

    hasActiveFilters = computed(() => this.filterStatus().length > 0 || this.startDate() !== '' || this.endDate() !== '');

    constructor() {
        this.wsService.messages().forEach((msg: WebSocketMessage) => {
            if (msg.type === 'db_update' && msg.data.table === 'news') {
                this.newsResource.reload();
            }
        });
    }
}
