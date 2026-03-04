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

    getLogs(page: number = 0, limit: number = 50, filters?: {
        module?: string[],
        action?: string[],
        user_id?: string,
        start_date?: string,
        end_date?: string
    }): Observable<AuditLog[]> {
        let params = new HttpParams()
            .set('skip', (page * limit).toString())
            .set('limit', limit.toString());

        if (filters?.module && filters.module.length > 0) {
            filters.module.forEach(m => params = params.append('module', m));
        }
        if (filters?.action && filters.action.length > 0) {
            filters.action.forEach(a => params = params.append('action', a));
        }
        if (filters?.user_id) params = params.set('user_id', filters.user_id);
        if (filters?.start_date) params = params.set('start_date', filters.start_date);
        if (filters?.end_date) params = params.set('end_date', filters.end_date);

        return this.http.get<AuditLog[]>(this.apiUrl, { params });
    }
}
