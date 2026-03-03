import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { StoreService } from './services/store.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private authService = inject(AuthService);
  private wsService = inject(WebSocketService);
  private store = inject(StoreService); // Ensure store is initialized
  private router = inject(Router);

  // Use toSignal to reactively update based on router events, compatible with OnPush
  readonly isLoginPage = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url === '/login' || this.router.url.startsWith('/login?'))
    ),
    { initialValue: false }
  );

  readonly isAuthenticated = this.authService.isAuthenticated;

  isSidebarOpen = false;
  isSidebarCollapsed = false;

  toggleSidebarCollapse() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  constructor() {
    // React to authentication state to manage WebSocket connection
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.wsService.connect();
      } else {
        this.wsService.disconnect();
      }
    });
  }
}

