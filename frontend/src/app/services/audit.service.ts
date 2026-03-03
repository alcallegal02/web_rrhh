import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../config/environment';
import { Observable } from 'rxjs';

export interface AuditLog {
    id: string;
    user_id: string | null;
    user: {
        first_name: string;
        last_name: string;
        email: string;
    } | null;
    action: string;
    module: string;
    details: any;
    ip_address: string | null;
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuditService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/audit`;

    getLogs(page: number = 0, limit: number = 50, filters?: { module?: string, action?: string, user_id?: string }): Observable<AuditLog[]> {
        let params = new HttpParams()
            .set('skip', (page * limit).toString())
            .set('limit', limit.toString());

        if (filters?.module) params = params.set('module', filters.module);
        if (filters?.action) params = params.set('action', filters.action);
        if (filters?.user_id) params = params.set('user_id', filters.user_id);

        return this.http.get<AuditLog[]>(this.apiUrl, { params });
    }
}
