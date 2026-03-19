import { Component, signal, computed, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NewsService } from '../../services/news.service';
import { WebSocketService, WebSocketMessage } from '../../services/websocket.service';
import { News } from '../../models/app.models';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../config/environment';

// Components
import { NewsListComponent } from './components/news-list/news-list.component';
import { NewsFormComponent, NewsFormModel } from './components/news-form/news-form.component';
import { DialogService } from '../../services/dialog.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideNewspaper, lucideFilter, lucideX, lucideChevronDown, lucideSend, lucideFileEdit, lucideArchive, lucidePlus } from '@ng-icons/lucide';

import { DataFilterComponent } from '../../shared/components/data-filter/data-filter.component';
import { FilterField, FilterValue } from '../../shared/utils/filter.utils';

@Component({
  selector: 'app-news',
  imports: [NewsListComponent, NewsFormComponent, NgIconComponent, DataFilterComponent],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss',
  providers: [provideIcons({ lucideNewspaper, lucideFilter, lucideX, lucideChevronDown, lucideSend, lucideFileEdit, lucideArchive, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsComponent {
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);
  private readonly newsService = inject(NewsService);
  private readonly wsService = inject(WebSocketService);

  // Schema de Filtros - Esto es lo único que define la página
  readonly filterSchema: FilterField[] = [
    { key: 'search', label: 'Buscar por título', type: 'text', placeholder: 'Título de la noticia...' },
    { 
      key: 'status', label: 'Estado', type: 'select', 
      options: [
        { label: 'Borrador', value: 'borrador' },
        { label: 'Publicada', value: 'publicada' },
        { label: 'Archivada', value: 'archivada' }
      ]
    },
    { key: 'start_date', label: 'Fecha desde', type: 'date' },
    { key: 'end_date', label: 'Fecha hasta', type: 'date' }
  ];

  // Estado de filtros
  readonly activeFilters = signal<FilterValue>({});

  // Data
  readonly newsListResource = rxResource({
    params: () => ({
      filters: this.activeFilters()
    }),
    stream: ({ params }) => {
      const f = params.filters;
      return this.newsService.getAllNews(
        100,
        0,
        f['status'] ? [f['status']] : undefined,
        f['start_date'],
        f['end_date']
      );
    }
  });

  onFiltersChanged(values: FilterValue): void {
    this.activeFilters.set(values);
  }

  readonly isAdmin = computed(() => {
    return this.authService.isRRHH() || this.authService.isAdmin() || this.authService.isSuperadmin();
  });

  readonly newsList = computed(() => this.newsListResource.value() ?? []);
  readonly loading = signal(false);

  // State
  readonly editingNewsId = signal<string | null>(null);
  readonly initialFormData = signal<NewsFormModel | null>(null);

  constructor() {
    // Escuchar actualizaciones vía WebSocket de forma reactiva
    effect(() => {
      const messages = this.wsService.messages();
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.type === 'db_update' && lastMsg.data.table === 'news') {
        this.newsListResource.reload();
      }
    });
  }

  private readonly dialogService = inject(DialogService);

  // --- List Actions ---
  onEdit(news: News): void {
    let publishDateFormatted = '';
    if (news.publish_date) {
      const date = new Date(news.publish_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      publishDateFormatted = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    const formModel: NewsFormModel = {
      id: news.id,
      title: news.title,
      summary: news.summary ?? '',
      content: news.content ?? '',
      cover_image_url: news.cover_image_url ?? '',
      status: news.status as any,
      publish_date: publishDateFormatted,
      attachments: (news as any).attachments ?? [],
      carousel_images: news.carousel_images ?? []
    };

    this.editingNewsId.set(news.id);
    this.initialFormData.set(formModel);

    // Scroll suave al formulario
    document.getElementById('newsForm')?.scrollIntoView({ behavior: 'smooth' });
  }

  async onDelete(id: string): Promise<void> {
    const confirmed = await this.dialogService.danger(
      'Eliminar Noticia',
      '¿Estás seguro de que deseas eliminar esta noticia permanentemente? Esta acción borrará también todos sus archivos asociados.'
    );

    if (confirmed) {
      this.loading.set(true);
      this.newsService.deleteNews(id).subscribe({
        next: () => {
          this.newsListResource.reload();
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    }
  }

  onStatusChange(event: { id: string, status: string }): void {
    const params = new HttpParams().set('new_status', event.status);
    this.http.patch<News>(`${environment.apiUrl}/news/${event.id}/status`, null, { params })
      .subscribe({
        next: () => this.newsListResource.reload(),
        error: (err) => alert('Error al cambiar el estado: ' + (err.error?.detail || err.message))
      });
  }

  // --- Form Actions ---
  onSave(formData: NewsFormModel): void {
    this.loading.set(true);
    const id = this.editingNewsId();

    // Map null to undefined for cover_image_url to match NewsCreate/Partial<NewsCreate>
    const payload = {
      ...formData,
      cover_image_url: formData.cover_image_url === null ? undefined : formData.cover_image_url
    } as any;

    const request$ = id 
      ? this.newsService.updateNews(id, payload)
      : this.newsService.createNews(payload);

    request$.subscribe({
      next: () => {
        this.newsListResource.reload();
        this.resetForm();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onCancel(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.editingNewsId.set(null);
    this.initialFormData.set(null);
  }
}
