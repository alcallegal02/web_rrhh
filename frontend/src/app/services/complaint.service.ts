import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';
import { StoreService } from './store.service';
import { Complaint } from '../models/app.models';


export interface ComplaintCreateResponse {
    code: string;
    access_token: string;
    // Include other fields from Complaint if needed, or extends Complaint
}

export interface ComplaintMessage {
    id: string;
    sender_type: 'user' | 'admin';
    content: string;
    created_at: string;
    is_internal?: boolean;
}

import { WebSocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class ComplaintService {
    private http = inject(HttpClient);
    private store = inject(StoreService);
    private wsService = inject(WebSocketService);
    private apiUrl = `${environment.apiUrl}/complaint`;

    // Expose signal from store
    complaints = computed(() => this.store.complaints().items as Complaint[]);

    constructor() {
        this.initRealTimeUpdates();
    }

    private initRealTimeUpdates() {
        this.wsService.messages$.subscribe(msg => {
            if (msg.type === 'db_update' && msg.data.table === 'complaints') {
                // Refresh complaints list (Admin)
                // Or individual status? 
                // If Admin, getAll. If user, maybe refresh status if viewing.
                // For now, safe to refresh All if we are Admin (handled by getAll internal logic or component call)
                // But wait, getAll takes status param.
                // We can simply set store empty or re-fetch default.
                // Let's rely on component calling getAll, OR we trigger a refresh of what's currently in store?
                // Simple approach: Re-fetch all if we have data?
                // Actually this service doesn't hold state except via store.
                // StoreService holds 'complaints'. 
                // Use case: Admin panel open. New complaint arrives.
                // We should re-fetch.
                this.getAllComplaints().subscribe();
            }
        });
    }

    createComplaint(formData: FormData): Observable<ComplaintCreateResponse> {
        return this.http.post<ComplaintCreateResponse>(this.apiUrl, formData);
    }

    getComplaintStatus(code: string, token: string): Observable<Complaint> {
        return this.http.get<Complaint>(`${this.apiUrl}/status/${code}`, {
            params: { access_token: token }
        });
    }

    // Admin methods
    getAllComplaints(status?: string): Observable<Complaint[]> {
        const params: any = {};
        if (status) params.status = status;
        return this.http.get<Complaint[]>(`${this.apiUrl}/admin/all`, { params }).pipe(
            tap(items => this.store.setComplaints(items))
        );
    }

    replyToComplaint(complaintId: string, content: string, token?: string): Observable<ComplaintMessage> {
        const params: any = {};
        if (token) params.access_token = token;
        return this.http.post<ComplaintMessage>(`${this.apiUrl}/${complaintId}/reply`, { content }, { params });
    }

    updateComplaintStatus(complaintId: string, data: FormData): Observable<Complaint> {
        return this.http.patch<Complaint>(`${this.apiUrl}/${complaintId}/status`, data);
    }

    deleteComplaint(complaintId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/admin/${complaintId}`);
    }
}
