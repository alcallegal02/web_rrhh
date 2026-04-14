import { Injectable, inject, computed, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    private readonly http = inject(HttpClient);
    private readonly store = inject(StoreService);
    private readonly wsService = inject(WebSocketService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly apiUrl = `${environment.apiUrl}/vacation`;

    // Expose signal from store
    vacations = this.store.vacations;
    holidays = computed(() => this.store.vacations().holidays as Holiday[]);

    constructor() {
        // takeUntilDestroyed() reemplaza la gestión manual de Subscription/ngOnDestroy
        this.wsService.messages$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(msg => {
            if (msg.type === 'db_update') {
                if (msg.data.table === 'vacation_requests') {
                    this.getMyRequests().subscribe();
                    this.getPendingManagerRequests().subscribe();
                } else if (msg.data.table === 'holidays') {
                    this.getHolidays(new Date().getFullYear()).subscribe();
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
                this.store.setVacations(current.map(r => r.id === req.id ? req : r));
            })
        );
    }

    uploadFile(file: File): Observable<{ url: string; filename: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ url: string; filename: string }>(
            `${environment.apiUrl}/upload/document?module=vacations`,
            formData
        );
    }

    getBalance(): Observable<VacationBalance> {
        return this.http.get<VacationBalance>(`${this.apiUrl}/balance`);
    }

    getHolidays(year: number): Observable<Holiday[]> {
        return this.http.get<Holiday[]>(`${environment.apiUrl}/holidays?year=${year}`).pipe(
            tap(holidays => this.store.setHolidays(holidays))
        );
    }

    getAvailableResponsibles(): Observable<ResponsibleUser[]> {
        return this.http.get<ResponsibleUser[]>(`${this.apiUrl}/available-responsibles`);
    }

    createRequest(request: Partial<VacationRequest>): Observable<VacationRequest> {
        return this.http.post<VacationRequest>(this.apiUrl, request).pipe(
            tap(newReq => this.store.setVacations([newReq, ...this.store.vacations().requests]))
        );
    }

    updateRequest(id: string, request: Partial<VacationRequest>): Observable<VacationRequest> {
        return this.http.put<VacationRequest>(`${this.apiUrl}/${id}`, request).pipe(
            tap(updatedReq => {
                const updated = this.store.vacations().requests.map(r => r.id === updatedReq.id ? updatedReq : r);
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

    deleteRequest(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
            tap(() => {
                const updated = this.store.vacations().requests.filter(r => r.id !== id);
                this.store.setVacations(updated);
            })
        );
    }

    getManagedRequests(status?: string): Observable<VacationRequest[]> {
        let params = new HttpParams();
        if (status) {
            params = params.set('status_filter', status);
        }
        return this.http.get<VacationRequest[]>(`${this.apiUrl}/managed`, { params });
    }

    getManagedStats(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/stats/managed`);
    }
}

// Por qué esta estructura es más escalable:
// takeUntilDestroyed() es la forma idiomática Angular 21 de limpiar suscripciones en servicios,
// eliminando la necesidad de implementar OnDestroy y gestionar Subscription manualmente.
