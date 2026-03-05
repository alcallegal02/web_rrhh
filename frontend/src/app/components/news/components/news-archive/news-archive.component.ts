import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsService } from '../../../../services/news.service';
import { WebSocketService } from '../../../../services/websocket.service';
import { AuthService } from '../../../../services/auth.service';
import { News } from '../../../../models/app.models';
import { rxResource } from '@angular/core/rxjs-interop';
import { NewsListComponent } from '../news-list/news-list.component';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-news-archive',
    imports: [CommonModule, NewsListComponent, RouterModule, NgIconComponent],
    template: `
    <div class="space-y-8 pb-8 animate-fadeIn">
        @if (authService.isRRHH() || authService.isSuperadmin() || authService.isAdmin()) {
          <div class="flex justify-end mb-6">
            <a routerLink="/news/manage" class="group flex items-center gap-2 bg-inespasa-dark text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all hover:scale-105 active:scale-95">
                <span class="text-lg flex items-center"><ng-icon name="lucideSettings"></ng-icon></span>
                Gestión de Noticias
            </a>
          </div>
        }

        <!-- News List (ReadOnly) -->
        <app-news-list 
            [newsList]="publishedNews()"
            layout="grid"
            [canManage]="false">
        </app-news-list>

        @if (publishedNews().length === 0 && !newsResource.isLoading()) {
            <div class="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <span class="text-6xl mb-4 text-gray-300 flex items-center"><ng-icon name="lucideMail"></ng-icon></span>
                <p class="text-gray-400 font-bold uppercase tracking-widest text-xs">No hay noticias publicadas en este momento</p>
            </div>
        }
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

    newsResource = rxResource({
        stream: () => this.newsService.getAllNews(100, 0, ['publicada'])
    });

    publishedNews = computed(() => {
        const items = this.newsResource.value() || [];
        return [...items].sort((a, b) => {
            const dateA = a.publish_date ? new Date(a.publish_date).getTime() : 0;
            const dateB = b.publish_date ? new Date(b.publish_date).getTime() : 0;
            return dateB - dateA;
        });
    });

    constructor() {
        this.wsService.messages().forEach((msg: { type: string; data: any }) => {
            if (msg.type === 'db_update' && msg.data.table === 'news') {
                this.newsResource.reload();
            }
        });
    }
}
