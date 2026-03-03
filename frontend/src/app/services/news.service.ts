import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';
import { StoreService } from './store.service';
import { News } from '../models/app.models';

export interface NewsCreate {
    title: string;
    summary?: string;
    content: string;
    cover_image_url?: string;
    status?: 'borrador' | 'publicada' | 'archivada';
    publish_date?: string;
    attachments?: { file_url: string; file_original_name: string }[];
}

@Injectable({
    providedIn: 'root'
})
export class NewsService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/news`;

    getLatestNews(): Observable<News> {
        return this.http.get<News>(`${this.apiUrl}/latest`);
    }

    getNewsById(id: string): Observable<News> {
        return this.http.get<News>(`${this.apiUrl}/${id}`);
    }

    getAllNews(limit = 20, offset = 0, status?: string): Observable<News[]> {
        const params: any = { limit: limit.toString(), offset: offset.toString() };
        if (status) {
            params.status = status;
        }

        return this.http.get<News[]>(this.apiUrl, { params });
    }

    createNews(news: NewsCreate): Observable<News> {
        // The backend trigger will update the store via WebSocket, 
        // but we can optimistic update or just let the socket handle it.
        // For now, relies on socket for the list update.
        return this.http.post<News>(this.apiUrl, news);
    }

    updateNews(id: string, news: Partial<NewsCreate>): Observable<News> {
        return this.http.put<News>(`${this.apiUrl}/${id}`, news);
    }

    deleteNews(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}
