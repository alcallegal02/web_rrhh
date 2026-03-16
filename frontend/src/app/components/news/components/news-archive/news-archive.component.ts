import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    standalone: true,
    imports: [CommonModule, NewsListComponent, RouterModule, NgIconComponent],
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
    template: `
    <div class="space-y-6 pb-8 animate-fadeIn">
        
        <!-- UNIFIED TOP BAR FOR EVERYONE -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col xl:flex-row items-center justify-start gap-8 lg:gap-12">
            <!-- Left Icon Section -->
            <div class="flex items-center gap-4 min-w-[200px]">
                <div class="h-10 w-10 rounded-xl bg-inespasa-dark/5 text-inespasa-dark flex items-center justify-center">
                    <ng-icon name="lucideFilter" class="text-xl"></ng-icon>
                </div>
                <div>
                    <h3 class="font-black text-gray-900 uppercase tracking-widest text-[10px]">Filtrar Noticias</h3>
                    <p class="text-[9px] text-gray-400 font-medium uppercase tracking-[0.1em] mt-0.5">Explora el histórico</p>
                </div>
            </div>

            <div class="flex flex-col md:flex-row items-center gap-6 w-full xl:w-auto">
                
                <!-- Date Filters (The classic part) -->
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div class="relative group w-full sm:w-44">
                        <input type="date" [value]="startDate()" (input)="setStartDate($any($event.target).value)"
                            class="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-inespasa-dark/20 transition-all outline-none">
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm group-focus-within:text-inespasa-dark transition-colors pointer-events-none">
                            <ng-icon name="lucideCalendar"></ng-icon>
                        </span>
                    </div>
                    <div class="h-px w-4 bg-gray-200 hidden sm:block"></div>
                    <div class="relative group w-full sm:w-44">
                        <input type="date" [value]="endDate()" (input)="setEndDate($any($event.target).value)"
                            class="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-inespasa-dark/20 transition-all outline-none">
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm group-focus-within:text-inespasa-dark transition-colors pointer-events-none">
                            <ng-icon name="lucideCalendar"></ng-icon>
                        </span>
                    </div>
                </div>

                <!-- Admin Status Filters (Restored logic but in the horizontal bar) -->
                @if (isAdminUser()) {
                    <div class="h-8 w-px bg-gray-100 hidden md:block"></div>
                    <div class="flex flex-wrap gap-2">
                        @for (status of statusOptions; track status.value) {
                        <button (click)="toggleStatus(status.value)"
                            class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all shadow-sm active:scale-95"
                            [class]="isSelected(status.value) ? 'bg-inespasa-dark text-white border-inespasa-dark' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-100'">
                            <ng-icon [name]="status.icon" class="text-sm"></ng-icon>
                            {{ status.label }}
                        </button>
                        }
                    </div>
                    
                    <div class="h-8 w-px bg-gray-100 hidden xl:block"></div>
                    <a routerLink="/news/manage" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-inespasa-dark text-white hover:bg-blue-800 transition-all text-[10px] font-bold uppercase tracking-widest shadow-lg">
                        <ng-icon name="lucideSettings" class="text-sm"></ng-icon>
                        Gestión de Noticias
                    </a>
                }

                @if (hasActiveFilters()) {
                    <button (click)="clearFilters()" 
                        class="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center shadow-sm"
                        title="Limpiar filtros">
                        <ng-icon name="lucideX" class="text-lg"></ng-icon>
                    </button>
                }
            </div>
        </div>

        <!-- News Grid (Full Width) -->
        <div class="h-full">
            <app-news-list 
                [newsList]="newsItems()"
                layout="grid"
                [canManage]="isAdminUser()">
            </app-news-list>

            @if (newsItems().length === 0 && !newsResource.isLoading()) {
                <div class="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                    <div class="h-24 w-24 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                        <ng-icon name="lucideNewspaper" class="text-5xl text-gray-100"></ng-icon>
                    </div>
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No se encontraron noticias</p>
                </div>
            }
        </div>
    </div>
  `,
    styles: [`
    :host { display: block; }
  `],
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
