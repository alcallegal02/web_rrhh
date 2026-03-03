import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface OrgNode {
    id: string;
    full_name: string;
    email: string;
    role: string;
    position_name?: string;
    department_name?: string;
    photo_url?: string;
    children: OrgNode[];
    // UI State
    expanded?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class OrgChartService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/org-chart`;

    getOrgChart(): Observable<OrgNode[]> {
        return this.http.get<OrgNode[]>(this.apiUrl);
    }
}
