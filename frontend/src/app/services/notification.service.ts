import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';
import { Observable, tap } from 'rxjs';
import { NotificationResponse } from '../models/app.models'; // I'll need to double check if it's there

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/notifications`;
    
    private readonly _notifications = signal<any[]>([]);
    readonly notifications = this._notifications.asReadonly();
    readonly unreadCount = signal(0);

    loadNotifications() {
        return this.http.get<any[]>(this.apiUrl).pipe(
            tap(notifs => {
                this._notifications.set(notifs);
                this.unreadCount.set(notifs.filter(n => !n.is_read).length);
            })
        ).subscribe();
    }

    markAsRead(id: string) {
        return this.http.post(`${this.apiUrl}/${id}/read`, {}).pipe(
            tap(() => {
                this._notifications.update(list => list.map(n => n.id === id ? { ...n, is_read: true } : n));
                this.unreadCount.update(c => Math.max(0, c - 1));
            })
        );
    }

    markAllAsRead() {
        return this.http.post(`${this.apiUrl}/read-all`, {}).pipe(
            tap(() => {
                this._notifications.update(list => list.map(n => ({ ...n, is_read: true })));
                this.unreadCount.set(0);
            })
        );
    }
    
    addNotificationFromSocket(notif: any) {
        this._notifications.update(list => [notif, ...list.slice(0, 19)]);
        if (!notif.is_read) {
            this.unreadCount.update(c => c + 1);
        }
    }
}
