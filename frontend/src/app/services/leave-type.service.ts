import { Injectable, inject, signal } from '@angular/core';
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
    private apiUrl = `${environment.apiUrl}/leave-types`;

    leaveTypes = signal<LeaveType[]>([]);

    getLeaveTypes(activeOnly = true): Observable<LeaveType[]> {
        return this.http.get<LeaveType[]>(this.apiUrl, { params: { active_only: activeOnly } }).pipe(
            tap(types => this.leaveTypes.set(types))
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
