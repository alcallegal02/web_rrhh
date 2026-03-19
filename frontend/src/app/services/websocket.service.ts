import { Injectable, signal, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../config/environment';

export interface WebSocketMessage {
  type: string;
  data?: any;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  // Inject services using inject() function (Angular 21 modern syntax)
  private authService = inject(AuthService);

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: any = null;

  private _connected = signal<boolean>(false);
  private _messages = signal<WebSocketMessage[]>([]);
  // Subject to emit *new* individual messages as they arrive
  private messageSubject = new Subject<WebSocketMessage>();

  connected = this._connected.asReadonly();
  messages = this._messages.asReadonly();
  // Public observable for the Store
  messages$ = this.messageSubject.asObservable();

  connect(): void {
    const token = this.authService.getToken();
    if (!token || this.authService.isTokenExpired(token)) {
      console.warn('Cannot connect WebSocket: No authentication token or token expired');
      this._connected.set(false);
      return;
    }

    try {
      const wsUrl = `${environment.wsUrl}/${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {

        this._connected.set(true);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle pong responses
          if (message.type === 'pong') {
            return;
          }

          // Add message to signal (optional keep history)
          this._messages.update(messages => [...messages, message]);

          // Emit to stream
          this.messageSubject.next(message);

          // Handle specific message types
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._connected.set(false);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this._connected.set(false);
        this.stopHeartbeat();
        
        // If closed due to invalid authentication (backend code 1008)
        // or other permanent policy violations, DO NOT RECONNECT
        if (event.code === 1008) {
          console.error('WebSocket closed: Invalid authentication. Stopping reconnection.');
          this.authService.logout();
          return;
        }

        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected.set(false);
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'vacation_status_change':
        // Handle vacation status change
        break;
      case 'new_news':
        // Handle new news notification
        break;
      case 'db_update':
        // Handled by StoreService
        break;
      case 'COMPLAINT_CREATED':
      case 'COMPLAINT_COMMENT_ADDED':
      case 'COMPLAINT_STATUS_CHANGED':
        // Handled by individual components listening to messages$
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      // console.log(`Attempting to reconnect in ${delay}ms...`);

      setTimeout(() => {
        if (this.authService.isAuthenticated()) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  clearMessages(): void {
    this._messages.set([]);
  }
}
