import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface ConvenioConfig {
    id: string;
    year_reference: number;
    vacation_days_annual: number;
    personal_days_hours: number;
    compensated_days_hours: number;
    medical_general_hours: number;
    medical_specialist_hours: number;
    paid_leave_hours: number;
    extra_hours_pool: number;
    union_hours: number;
    annual_work_hours: number;
    daily_work_hours: number;
    maternity_weeks_total: number;
    maternity_weeks_mandatory: number;
    valid_from: string;
    valid_to: string;
    default_shift_start: string;
    default_shift_end: string;
    updated_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class ConvenioService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/convenio`;

    getAllConfigs(): Observable<ConvenioConfig[]> {
        // Using trailing slash to match backend expectations and avoid redirects
        return this.http.get<ConvenioConfig[]>(`${this.apiUrl}/`);
    }

    getConfigByYear(year: number): Observable<ConvenioConfig> {
        return this.http.get<ConvenioConfig>(`${this.apiUrl}/${year}`);
    }

    createConfig(config: Partial<ConvenioConfig>): Observable<ConvenioConfig> {
        return this.http.post<ConvenioConfig>(this.apiUrl, config);
    }

    updateConfig(id: string, config: Partial<ConvenioConfig>): Observable<ConvenioConfig> {
        return this.http.patch<ConvenioConfig>(`${this.apiUrl}/${id}`, config);
    }
}
