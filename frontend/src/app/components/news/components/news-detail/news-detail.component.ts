import { Component, signal, inject, computed, effect, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { NewsService } from '../../../../services/news.service';
import { AuthService } from '../../../../services/auth.service';
import { News } from '../../../../models/app.models';
import { environment } from '../../../../config/environment';
import { FileUrlPipe } from '../../../../shared/pipes/file-url.pipe';
import { SafePipe } from '../../../../shared/pipes/safe.pipe';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';
import { lucideEye, lucideDownload, lucideX, lucideMaximize, lucideLoader2, lucideCalendarDays, lucideNewspaper, lucidePaperclip, lucideChevronRight, lucideImagePlus, lucideFileText } from '@ng-icons/lucide';

@Component({
    selector: 'app-news-detail',
    imports: [RouterModule, DatePipe, FileUrlPipe, NgIconComponent, ImageCarouselComponent, SafePipe],
    providers: [
        provideIcons({
            lucideEye, lucideDownload, lucideX, lucideMaximize, lucideLoader2, 
            lucideCalendarDays, lucideNewspaper, lucidePaperclip, lucideChevronRight,
            lucideImagePlus, lucideFileText
        })
    ],
    templateUrl: './news-detail.component.html',
    styleUrl: './news-detail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private newsService = inject(NewsService);
    public authService = inject(AuthService);
    private sanitizer = inject(DomSanitizer);
    private fileUrlPipe = new FileUrlPipe();

    // Preview State
    isPreviewOpen = signal(false);
    previewFile = signal<{url: string, name: string, type: 'pdf' | 'image' | 'other', safeUrl?: SafeResourceUrl} | null>(null);

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
        stream: () => this.newsService.getAllNews(11, 0, ['publicada'])
    });

    news = computed(() => this.newsResource.value() || null);
    otherNews = computed(() => {
        const data = this.otherNewsResource.value() || [];
        const id = this.currentId();
        return data.filter(n => n.id !== id).slice(0, 10);
    });

    canManage = computed(() => 
        this.authService.isRRHH() || this.authService.isAdmin() || this.authService.isSuperadmin()
    );

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

    isPdf(filename: string): boolean {
        if (!filename) return false;
        return filename.toLowerCase().endsWith('.pdf');
    }

    openPreview(att: any): void {
        const url = this.fileUrlPipe.transform(att.file_url);
        let type: 'pdf' | 'image' | 'other' = 'other';
        let safeUrl: SafeResourceUrl | undefined;

        if (this.isPdf(att.file_url)) {
            type = 'pdf';
            const pdfUrl = `${url}#toolbar=1&view=FitH`;
            safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);
        } else if (this.isImage(att.file_url)) {
            type = 'image';
        }

        this.previewFile.set({
            url,
            name: att.file_original_name,
            type,
            safeUrl
        });
        this.isPreviewOpen.set(true);
        // Prevent scrolling while preview is open
        document.body.style.overflow = 'hidden';
    }

    closePreview(): void {
        this.isPreviewOpen.set(false);
        this.previewFile.set(null);
        document.body.style.overflow = 'auto';
    }

    goBack(): void {
        this.router.navigate(['/news']);
    }
}
