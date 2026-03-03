import { Injectable, inject, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/environment';

export interface LeaveType {
    id: string;
    name: string;
    description?: string;
    days_allocated: number;
    is_work_days: boolean;
    requires_justification: boolean;
    active: boolean;
}

export interface LeaveTypeCreate {
    name: string;
    description?: string;
    days_allocated: number;
    is_work_days: boolean;
    requires_justification: boolean;
    active: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class LeaveTypeService {
    private http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/leave-types`;

    leaveTypesResource = rxResource({
        stream: () => this.http.get<LeaveType[]>(this.apiUrl, { params: { active_only: true } })
    });

    leaveTypes = computed(() => this.leaveTypesResource.value() ?? []);

    // For backwards compatibility or explicit refresh
    getLeaveTypes(activeOnly = true): Observable<LeaveType[]> {
        if (activeOnly !== true) {
            // Just doing a fast fetch for non-active
            return this.http.get<LeaveType[]>(this.apiUrl, { params: { active_only: activeOnly } });
        }
        return this.http.get<LeaveType[]>(this.apiUrl, { params: { active_only: activeOnly } }).pipe(
            tap(() => this.leaveTypesResource.reload())
        );
    }

    createLeaveType(type: LeaveTypeCreate): Observable<LeaveType> {
        return this.http.post<LeaveType>(this.apiUrl, type);
    }

    updateLeaveType(id: string, type: Partial<LeaveTypeCreate>): Observable<LeaveType> {
        return this.http.put<LeaveType>(`${this.apiUrl}/${id}`, type);
    }

    deleteLeaveType(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    seedDefaults(): Observable<any> {
        return this.http.post(`${this.apiUrl}/seed-defaults`, {});
    }
}
