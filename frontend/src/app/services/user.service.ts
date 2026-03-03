import { Injectable, inject, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';
import { StoreService } from './store.service';

// Role type duplicate or import?
// Let's import Role from auth service to keep consistency
import { Role } from './auth.service';

export interface UserResponse {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    full_name: string; // Helper for display
    role: Role;

    // Relations
    managers: { id: string, first_name: string, last_name: string, full_name: string }[];
    rrhh_responsibles: { id: string, first_name: string, last_name: string, full_name: string }[];
    parent?: { id: string, first_name: string, last_name: string, full_name: string };

    // Display fields (backend likely returns names)
    department?: string;
    department_id?: string;
    position?: string;
    position_id?: string;

    photo_url?: string;
    attachments: UserAttachmentResponse[];
    is_active: boolean;

    // Timestamps
    created_at: string;
    updated_at: string;
    created_by_name?: string;
    updated_by_name?: string;

    // Vacation/Rights Profile
    vac_days: number;
    vac_hours: number;
    asuntos_propios_days: number;
    asuntos_propios_hours: number;
    dias_compensados_days: number;
    dias_compensados_hours: number;
    med_gral_days: number;
    med_gral_hours: number;
    med_especialista_days: number;
    med_especialista_hours: number;
    licencia_retribuida_days: number;
    licencia_retribuida_hours: number;
    bolsa_horas_days: number;
    bolsa_horas_hours: number;
    horas_sindicales_days: number;
    horas_sindicales_hours: number;

    // Contract info
    contract_start_date?: string; // ISO string
    contract_expiration_date?: string; // ISO string
    percentage_jornada: number;
}

export interface UserAttachmentResponse {
    id?: string; // made optional as it might not exist on upload
    user_id?: string;
    file_url: string;
    file_original_name?: string;
    created_at?: string;
}

import { WebSocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly http = inject(HttpClient);
    private readonly store = inject(StoreService);
    private readonly wsService = inject(WebSocketService);
    private readonly apiUrl = `${environment.apiUrl}/users`;

    // Native Resource API for users list
    usersResource = rxResource({
        stream: () => this.http.get<UserResponse[]>(this.apiUrl)
    });

    // Expose signal
    users = computed(() => this.usersResource.value() ?? []);

    constructor() {
        this.initRealTimeUpdates();
    }

    private initRealTimeUpdates() {
        this.wsService.messages$.subscribe(msg => {
            if (msg.type === 'db_update' && msg.data.table === 'users') {
                // On any user change, refresh the list to ensure full data (relations, etc)
                // This acts as a "Smart Invalidation"
                this.usersResource.reload();
            }
        });
    }

    createUser(user: Partial<UserResponse>): Observable<UserResponse> {
        return this.http.post<UserResponse>(this.apiUrl, user);
    }

    updateUser(id: string, user: Partial<UserResponse> & { password?: string, contract_expiration_date?: string | null, contract_start_date?: string | null }): Observable<UserResponse> {
        return this.http.put<UserResponse>(`${this.apiUrl}/${id}`, user);
    }

    deleteUser(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    uploadImage(file: File): Observable<{ url: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?module=users`, formData);
    }

    uploadDocument(file: File): Observable<{ url: string, filename: string, original_filename: string }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ url: string, filename: string, original_filename: string }>(
            `${environment.apiUrl}/upload/document?module=users`,
            formData
        );
    }
}
