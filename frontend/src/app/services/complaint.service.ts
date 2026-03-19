import { Injectable, inject, computed, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../config/environment';
import { StoreService } from './store.service';
import { Complaint, ComplaintComment } from '../models/app.models';


export interface ComplaintCreateResponse {
    code: string;
    access_token: string;
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
    private readonly http = inject(HttpClient);
    private readonly store = inject(StoreService);
    private readonly wsService = inject(WebSocketService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly apiUrl = `${environment.apiUrl}/complaint`;

    // Expose signal from store
    complaints = computed(() => this.store.complaints().items as Complaint[]);

    constructor() {
        // takeUntilDestroyed() gestiona la limpieza automática sin necesitar ngOnDestroy
        this.wsService.messages$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(msg => {
            if ((msg.type === 'db_update' && msg.data.table === 'complaints') ||
                msg.type === 'complaint_comment_added') {
                this.getAllComplaints().subscribe();
            }
        });
    }

    createComplaint(formData: FormData): Observable<ComplaintCreateResponse> {
        return this.http.post<ComplaintCreateResponse>(this.apiUrl, formData);
    }

    getComplaintStatus(code: string, token: string): Observable<Complaint> {
        return this.http.get<Complaint>(`${this.apiUrl}/${code}`, {
            params: { token: token }
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

    addPublicComment(code: string, token: string, content: string, files?: File[]): Observable<ComplaintComment> {
        const formData = new FormData();
        formData.append('content', content);
        if (files) {
            files.forEach(file => formData.append('files', file));
        }
        return this.http.post<ComplaintComment>(`${this.apiUrl}/${code}/comments`, formData, {
            params: { token }
        }).pipe(
            tap(comment => {
                // Para el reporteador público, necesitamos encontrar la ID de la denuncia
                // pero ya la tenemos cargada en el estado si estamos viendo los detalles.
                const complaints = this.store.complaints().items;
                const complaint = complaints.find(c => c.code === code);
                if (complaint) {
                    this.store.addCommentToComplaint(complaint.id, comment);
                }
            })
        );
    }

    addAdminComment(complaintId: string, content: string, isPublic: boolean, files?: File[]): Observable<ComplaintComment> {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('is_public', String(isPublic));
        if (files) {
            files.forEach(file => formData.append('files', file));
        }
        return this.http.post<ComplaintComment>(`${this.apiUrl}/admin/${complaintId}/comments`, formData).pipe(
            tap(comment => this.store.addCommentToComplaint(complaintId, comment))
        );
    }

    updateComplaintStatus(complaintId: string, data: FormData): Observable<Complaint> {
        return this.http.patch<Complaint>(`${this.apiUrl}/${complaintId}/status`, data).pipe(
            tap(updated => this.store.updateComplaint(updated))
        );
    }

    deleteComplaint(complaintId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/admin/${complaintId}`).pipe(
            tap(() => this.store.removeComplaint(complaintId))
        );
    }
}
