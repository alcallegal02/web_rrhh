import { Injectable, signal, computed, inject } from '@angular/core';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { News, VacationRequest, Holiday, User, Complaint, ComplaintComment } from '../models/app.models';

// Define State Interfaces
export interface NewsState {
    items: News[];
    lastUpdated: Date | null;
}

export interface VacationState {
    requests: VacationRequest[];
    holidays: Holiday[];
    lastUpdated: Date | null;
}

export interface ComplaintsState {
    items: Complaint[];
    lastUpdated: Date | null;
}

export interface AppState {
    news: NewsState;
    vacations: VacationState;

    complaints: ComplaintsState;
}

const initialState: AppState = {
    news: { items: [], lastUpdated: null },
    vacations: { requests: [], holidays: [], lastUpdated: null },

    complaints: { items: [], lastUpdated: null }
};

@Injectable({
    providedIn: 'root'
})
export class StoreService {
    private wsService = inject(WebSocketService);

    // The single source of truth
    private _state = signal<AppState>(initialState);

    // Selectors (Computed Signals)
    news = computed(() => this._state().news);
    vacations = computed(() => this._state().vacations);

    complaints = computed(() => this._state().complaints);

    constructor() {
        this.listenToWebSocket();
    }

    private listenToWebSocket() {
        // We need to verify if WebSocketService exposes an Observable stream.
        if (this.wsService.messages$) {
            this.wsService.messages$.pipe(
                takeUntilDestroyed()
            ).subscribe(message => {
                this.handleMessage(message);
            });
        }
    }

    private handleMessage(message: WebSocketMessage) {
        switch (message.type) {
            case 'db_update':
                this.handleDbUpdate(message.data);
                break;
            case 'COMPLAINT_CREATED':
                this.addComplaint(message.data);
                break;
            case 'COMPLAINT_UPDATED':
                this.updateComplaint(message.data);
                break;
            case 'COMPLAINT_DELETED':
                this.removeComplaint(message.id || message.data?.id);
                break;
            case 'new_news': // Legacy support during migration
            case 'vacation_status_change':
                // Handle specific legacy events if needed, or map them to generic updates
                break;
        }
    }

    private handleDbUpdate(payload: any) {
        // payload: { table, action, id }
        // Note: The payload no longer contains the full 'data' object for optimization reasons.
        // Therefore, we cannot perform optimistic updates or direct inserts here.
        // Instead, individual services (NewsService, VacationService, etc.) subscribe to 
        // these WebSocket events and trigger a re-fetch of the data.

        // This method is kept for future reference or if we implemented specific ID-based logic
        // (handle DELETE could be done here if we extract 'id', but re-fetching is safer/simpler).
        return;
    }

    // Actions
    setNews(items: News[]) {
        this._state.update(s => ({ ...s, news: { items, lastUpdated: new Date() } }));
    }

    setVacations(requests: VacationRequest[]) {
        this._state.update(s => ({ ...s, vacations: { ...s.vacations, requests, lastUpdated: new Date() } }));
    }

    setHolidays(holidays: Holiday[]) {
        this._state.update(s => ({ ...s, vacations: { ...s.vacations, holidays, lastUpdated: new Date() } }));
    }

    setComplaints(items: Complaint[]) {
        this._state.update(s => ({ ...s, complaints: { items, lastUpdated: new Date() } }));
    }

    addComplaint(item: Complaint) {
        this._state.update(s => {
            const exists = s.complaints.items.find(i => i.id === item.id);
            if (exists) return s;
            return {
                ...s,
                complaints: {
                    items: [item, ...s.complaints.items],
                    lastUpdated: new Date()
                }
            };
        });
    }

    updateComplaint(item: Complaint) {
        this._state.update(s => ({
            ...s,
            complaints: {
                items: s.complaints.items.map(i => i.id === item.id ? item : i),
                lastUpdated: new Date()
            }
        }));
    }

    addCommentToComplaint(complaintId: string, comment: ComplaintComment) {
        this._state.update(s => ({
            ...s,
            complaints: {
                items: s.complaints.items.map(i => {
                    if (i.id === complaintId) {
                        const comments = i.comments || [];
                        // Evitar duplicados si el WS ya lo metió
                        if (comments.find(c => c.id === comment.id)) return i;
                        return { ...i, comments: [...comments, comment] };
                    }
                    return i;
                }),
                lastUpdated: new Date()
            }
        }));
    }

    updateComplaintComments(id: string, comments: ComplaintComment[]) {
        this._state.update(s => ({
            ...s,
            complaints: {
                ...s.complaints,
                items: s.complaints.items.map(i => i.id === id ? { ...i, comments } : i),
                lastUpdated: new Date()
            }
        }));
    }

    removeComplaint(id: string) {
        if (!id) return;
        this._state.update(s => ({
            ...s,
            complaints: {
                items: s.complaints.items.filter(i => i.id !== id),
                lastUpdated: new Date()
            }
        }));
    }
}
