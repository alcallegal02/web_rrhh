import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';
import { Observable } from 'rxjs';

export type DurationUnit = 'days_natural' | 'days_work' | 'weeks' | 'hours';
export type Modality = 'presencial_ausente' | 'teletrabajo' | 'mixto';
export type PolicyResetType = 'anual_calendario' | 'anual_relativo' | 'por_evento' | 'sin_reinicio';

export interface PermissionPolicy {
    id: string;
    slug: string;
    name: string;
    description?: string;
    duration_value: number;
    duration_unit: DurationUnit;
    is_paid: boolean;
    requires_justification: boolean;
    modality: Modality;
    limit_age_child?: number;

    // Recurrence & Lifecycle (Refactor 2026)
    reset_type: PolicyResetType;
    reset_month?: number;
    reset_day?: number;
    max_usos_por_periodo?: number;
    max_days_per_period: number;
    max_duration_per_day?: number;
    validity_window_value: number;
    validity_window_unit: string;
    is_accumulable: boolean;
    accumulable_years: number;

    // Advanced Rules
    allow_split?: boolean;
    mandatory_immediate_duration?: number;
    split_min_duration?: number;
    // validity_months DEPRECATED (replaced by validity_window_value)

    // Specifics
    travel_extension_days: number;
    requires_document_type?: string;

    // Advanced Constraints
    min_advance_notice_days: number;
    requires_attachment: boolean;
    min_consecutive_days?: number;
    max_consecutive_days?: number;

    // Casuísticas Avanzadas
    min_seniority_months: number;
    max_days_from_event?: number;
    justification_deadline_days: number;
    attachment_type_label?: string;
    mandatory_request_fields?: string; // JSON Array representation

    color?: string;
    icon?: string;
    is_public_dashboard?: boolean;
    is_active: boolean;
    is_featured: boolean;
    is_system_default: boolean;
    created_at?: string;
    updated_at?: string;
}

export type PermissionPolicyCreate = Omit<PermissionPolicy, 'id' | 'is_active' | 'is_system_default' | 'created_at' | 'updated_at'>;
export type PermissionPolicyUpdate = Partial<PermissionPolicyCreate> & { is_active?: boolean };

@Injectable({
    providedIn: 'root'
})
export class PolicyService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/policies`;

    getPolicies(): Observable<PermissionPolicy[]> {
        return this.http.get<PermissionPolicy[]>(this.apiUrl);
    }

    getMyBalances(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/my-balances`);
    }

    createPolicy(policy: PermissionPolicyCreate): Observable<PermissionPolicy> {
        return this.http.post<PermissionPolicy>(this.apiUrl, policy);
    }

    updatePolicy(id: string, policy: PermissionPolicyUpdate): Observable<PermissionPolicy> {
        return this.http.put<PermissionPolicy>(`${this.apiUrl}/${id}`, policy);
    }

    deletePolicy(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getFormSchema(policyId: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${policyId}/form-schema`);
    }
}
