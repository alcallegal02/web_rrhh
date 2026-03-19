import { Component, ChangeDetectionStrategy, inject, effect, signal, viewChild } from '@angular/core';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { StoreService } from './services/store.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { DialogService } from './services/dialog.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly wsService = inject(WebSocketService);
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  readonly confirmDialog = viewChild(ConfirmDialogComponent);

  constructor() {
    effect(() => {
      const dialog = this.confirmDialog();
      if (dialog) {
        this.dialogService.register(dialog);
      }
    });
  }

  // Señal reactiva al evento de navegación — compatible con Zoneless CD
  readonly isLoginPage = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url === '/login' || this.router.url.startsWith('/login?'))
    ),
    { initialValue: false }
  );

  readonly isAuthenticated = this.authService.isAuthenticated;

  // Estado de UI como señales: mutaciones detectadas automáticamente sin zone.js
  readonly isSidebarOpen = signal(false);
  readonly isSidebarCollapsed = signal(false);

  // Effect a nivel de campo: se ejecuta fuera del constructor, más declarativo
  private readonly _wsEffect = effect(() => {
    if (this.authService.isAuthenticated()) {
      this.wsService.connect();
    } else {
      this.wsService.disconnect();
    }
  });

  toggleSidebarCollapse(): void {
    this.isSidebarCollapsed.update(v => !v);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }
}

// Por qué esta estructura es más escalable:
// Los signals de UI permiten que el CD zoneless detecte cambios de forma granular,
// y los effects a nivel de campo son más declarativos y no requieren constructor.


