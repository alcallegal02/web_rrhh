import { Component, signal, inject, computed, effect, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NewsService } from '../../../../services/news.service';
import { News } from '../../../../models/app.models';
import { environment } from '../../../../config/environment';
import { FileUrlPipe } from '../../../../pipes/file-url.pipe';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';

@Component({
    selector: 'app-news-detail',
    imports: [CommonModule, RouterModule, DatePipe, FileUrlPipe],
    templateUrl: './news-detail.component.html',
    styleUrl: './news-detail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private newsService = inject(NewsService);
    private sanitizer = inject(DomSanitizer);

    private paramMap = toSignal(this.route.paramMap);
    currentId = computed(() => this.paramMap()?.get('id') || null);

    newsResource = rxResource({
        params: () => this.currentId(),
        stream: ({ params }) => {
            if (!params) return of(null);
            return this.newsService.getNewsById(params).pipe(
                map(data => {
                    if (data && data.content) {
                        const cleanApiUrl = environment.apiUrl.replace('/api', '');
                        data.content = data.content.replace(
                            /src=["'](\/uploads\/[^"']+)["']/g,
                            `src="${cleanApiUrl}$1"`
                        );
                    }
                    return data;
                })
            );
        }
    });

    otherNewsResource = rxResource({
        stream: () => this.newsService.getAllNews(6, 0, 'publicada')
    });

    news = computed(() => this.newsResource.value() || null);
    otherNews = computed(() => {
        const data = this.otherNewsResource.value() || [];
        const id = this.currentId();
        return data.filter(n => n.id !== id).slice(0, 5);
    });

    // The legacy `loading` was used manually. With rxResource we expose it directly, or map to newsResource.isLoading
    loading = computed(() => this.newsResource.isLoading());
    error = computed(() => this.newsResource.error() ? 'No se pudo cargar la noticia o no tienes permisos para verla.' : null);

    constructor() {
        effect(() => {
            if (this.currentId()) {
                window.scrollTo(0, 0);
            } else if (this.paramMap()) {
                this.router.navigate(['/news']);
            }
        });
    }

    ngOnInit(): void {
        // Handled by rxResource
    }

    getSafeHtml(content: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(content);
    }

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

    goBack(): void {
        this.router.navigate(['/news']);
    }
}
