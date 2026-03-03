import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { Holiday, HolidayCreate, HolidayUpdate } from '../interfaces/holiday.interface';

import { WebSocketService } from './websocket.service';

@Injectable({
    providedIn: 'root'
})
export class HolidayService {
    private http = inject(HttpClient);
    private wsService = inject(WebSocketService);
    private apiUrl = `${environment.apiUrl}/holidays`;

    constructor() {
        this.initRealTimeUpdates();
    }

    private initRealTimeUpdates() {
        this.wsService.messages$.subscribe(msg => {
            if (msg.type === 'db_update' && msg.data.table === 'holidays') {
                // Refresh holidays. But getHolidays requires 'year'.
                // We can't guess the year easily unless we store it.
                // For now, let's assume current year + next year? 
                // Or just let component handle? 
                // If we strictly follow the pattern, we should refresh.
                // Let's fetch current year as default to keep main view updated.
                const currentYear = new Date().getFullYear();
                this.getHolidays(currentYear).subscribe();
            }
        });
    }

    getHolidays(year?: number): Observable<Holiday[]> {
        let params = new HttpParams();
        if (year) {
            params = params.set('year', year);
        }
        return this.http.get<Holiday[]>(this.apiUrl, { params });
    }

    createHoliday(holiday: HolidayCreate): Observable<Holiday> {
        return this.http.post<Holiday>(this.apiUrl, holiday);
    }

    deleteHoliday(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    updateHoliday(id: string, data: HolidayUpdate): Observable<Holiday> {
        return this.http.put<Holiday>(`${this.apiUrl}/${id}`, data);
    }
}
