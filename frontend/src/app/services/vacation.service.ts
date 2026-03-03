import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';
import { StoreService } from './store.service';
import { VacationRequest, Holiday } from '../models/app.models';

export interface CategoryBalance {
    total_days: number;
    used_days: number;
    pending_days: number;
    available_days: number;
}

export interface PolicyBalance {
    policy_id: string;
    slug: string;
    name: string;
    max_duration: number;
    unit: string;
    total_days: number;
    used_days: number;
    pending_days: number;
    available_days: number;
    total_value: number;
    available_value: number;
    is_public_dashboard: boolean;
    is_featured: boolean;
}

export interface VacationBalance {
    daily_work_hours: number;
    balances: PolicyBalance[];
}


export interface ResponsibleUser {
    id: string;
    full_name: string;
    email?: string;
    role?: string;
}

import { WebSocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class VacationService {
    private http = inject(HttpClient);
    private store = inject(StoreService);
    private wsService = inject(WebSocketService);
    private apiUrl = `${environment.apiUrl}/vacation`;

    // Expose signal from store
    vacations = this.store.vacations;
    holidays = computed(() => this.store.vacations().holidays as Holiday[]);

    constructor() {
        this.initRealTimeUpdates();
    }

    private initRealTimeUpdates() {
        this.wsService.messages$.subscribe(msg => {
            // vacation_requests table
            if (msg.type === 'db_update') {
                if (msg.data.table === 'vacation_requests') {
                    // Refresh my requests (if owner) and pending (if manager/rrhh)
                    this.getMyRequests().subscribe();
                    this.getPendingManagerRequests().subscribe();
                } else if (msg.data.table === 'holidays') {
                    // Refresh holidays
                    const currentYear = new Date().getFullYear();
                    this.getHolidays(currentYear).subscribe();
                }
            }
        });
    }

    getMyRequests(): Observable<VacationRequest[]> {
        return this.http.get<VacationRequest[]>(`${this.apiUrl}/my-requests`).pipe(
            tap(requests => this.store.setVacations(requests))
        );
    }

    submitExistingRequest(requestId: string): Observable<VacationRequest> {
        return this.http.post<VacationRequest>(`${this.apiUrl}/${requestId}/submit`, {}).pipe(
            tap(req => {
                const current = this.store.vacations().requests;
                const updated = current.map(r => r.id === req.id ? req : r);
                this.store.setVacations(updated);
            })
        );
    }

    uploadFile(file: File): Observable<{ url: string, filename: string }> {
        const formData = new FormData();
        formData.append('file', file);
        // Uses the generic upload endpoint with module='vacations'
        return this.http.post<{ url: string, filename: string }>(
            `${environment.apiUrl}/upload/document?module=vacations`,
            formData
        );
    }

    getBalance(): Observable<VacationBalance> {
        return this.http.get<VacationBalance>(`${this.apiUrl}/balance`);
    }

    getHolidays(year: number): Observable<Holiday[]> {
        return this.http.get<Holiday[]>(`${environment.apiUrl}/holidays?year=${year}`).pipe(
            tap(holidays => {
                this.store.setHolidays(holidays);
            })
        );
    }

    getAvailableResponsibles(): Observable<ResponsibleUser[]> {
        return this.http.get<ResponsibleUser[]>(`${this.apiUrl}/available-responsibles`);
    }

    createRequest(request: Partial<VacationRequest>): Observable<VacationRequest> {
        return this.http.post<VacationRequest>(this.apiUrl, request).pipe(
            tap(newReq => {
                const current = this.store.vacations().requests;
                this.store.setVacations([newReq, ...current]);
            })
        );
    }

    updateRequest(id: string, request: Partial<VacationRequest>): Observable<VacationRequest> {
        return this.http.put<VacationRequest>(`${this.apiUrl}/${id}`, request).pipe(
            tap(updatedReq => {
                const current = this.store.vacations().requests;
                const updated = current.map(r => r.id === updatedReq.id ? updatedReq : r);
                this.store.setVacations(updated);
            })
        );
    }

    getPendingManagerRequests(): Observable<VacationRequest[]> {
        return this.http.get<VacationRequest[]>(`${this.apiUrl}/pending-manager`);
    }

    getPendingRRHHRequests(): Observable<VacationRequest[]> {
        return this.http.get<VacationRequest[]>(`${this.apiUrl}/pending-rrhh`);
    }

    approveManager(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/approve-manager`, {});
    }

    rejectManager(id: string, reason: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/reject-manager`, null, { params: { reason } });
    }

    approveRRHH(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/approve-rrhh`, {});
    }

    rejectRRHH(id: string, reason: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/reject-rrhh`, null, { params: { reason } });
    }
}
