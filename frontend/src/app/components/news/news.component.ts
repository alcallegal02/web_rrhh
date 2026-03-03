import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NewsService } from '../../services/news.service';
import { WebSocketService } from '../../services/websocket.service';
import { News } from '../../models/app.models';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../config/environment';

// Components
import { NewsListComponent } from './components/news-list/news-list.component';
import { NewsFormComponent, NewsFormModel } from './components/news-form/news-form.component';

@Component({
  selector: 'app-news',
  imports: [CommonModule, NewsListComponent, NewsFormComponent],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsComponent {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  private newsService = inject(NewsService);
  private wsService = inject(WebSocketService);

  // Data
  newsListResource = rxResource({
    stream: () => this.newsService.getAllNews(100)
  });
  newsList = computed(() => this.newsListResource.value() || []);
  loading = signal(false);

  // State
  editingNewsId = signal<string | null>(null);
  initialFormData = signal<NewsFormModel | null>(null);

  constructor() {
    this.wsService.messages().forEach((msg: { type: string; data: any }) => {
      if (msg.type === 'db_update' && msg.data.table === 'news') {
        this.newsListResource.reload();
      }
    });
  }

  loadNews(): void {
    this.newsListResource.reload();
  }

  // --- List Actions ---

  onEdit(news: News): void {
    let publishDateFormatted = '';
    if (news.publish_date) {
      const date = new Date(news.publish_date);
      // Format to yyyy-MM-ddThh:mm for datetime-local
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
      summary: news.summary || '',
      content: news.content || '',
      cover_image_url: news.cover_image_url || '',
      status: news.status as any,
      publish_date: publishDateFormatted,
      attachments: (news as any).attachments || []
    };

    this.editingNewsId.set(news.id);
    this.initialFormData.set(formModel);

    setTimeout(() => {
      document.getElementById('newsForm')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  onDelete(id: string): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta noticia permanentemente? Esta acción borrará también todos sus archivos e imágenes asociados.')) {
      return;
    }

    this.loading.set(true);
    this.newsService.deleteNews(id).subscribe({
      next: () => {
        this.loadNews();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error deleting news:', err);
        alert('Error al eliminar la noticia');
        this.loading.set(false);
      }
    });
  }

  onStatusChange(event: { id: string, status: string }): void {
    const params = new HttpParams().set('new_status', event.status);
    this.http.patch<News>(`${environment.apiUrl}/news/${event.id}/status`, null, {
      params: params
    }).subscribe({
      next: () => {
        this.loadNews();
      },
      error: (err) => {
        console.error('Error updating news status:', err);
      }
    });
  }

  // --- Form Actions ---

  onSave(formData: NewsFormModel): void {
    this.loading.set(true);

    const newsData: any = { ...formData };
    if (!newsData.publish_date) delete newsData.publish_date;

    const id = this.editingNewsId();

    if (id) {
      // Update
      this.newsService.updateNews(id, newsData).subscribe({
        next: () => {
          this.loadNews();
          this.resetForm();
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error updating news:', err);
          this.loading.set(false);
        }
      });
    } else {
      // Create
      this.newsService.createNews(newsData).subscribe({
        next: () => {
          this.loadNews();
          this.resetForm();
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error creating news:', err);
          this.loading.set(false);
        }
      });
    }
  }

  onCancel(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.editingNewsId.set(null);
    this.initialFormData.set(null);
  }
}
