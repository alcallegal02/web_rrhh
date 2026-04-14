import { Component, inject, ChangeDetectionStrategy, input, output, effect } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import { NgIconComponent } from '@ng-icons/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-header',
  imports: [RouterModule, UserProfileModalComponent, NgIconComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  readonly notificationService = inject(NotificationService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  isCollapsed = input(false);
  toggleSidebar = output<void>();
  toggleSidebarCollapse = output<void>();

  // Use a signal to reactively update the page title
  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route.snapshot.data['title'] || '';
      })
    ),
    { initialValue: '' }
  );

  readonly isLoginPage = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url === '/login' || this.router.url.startsWith('/login?'))
    ),
    { initialValue: false }
  );

  isModalOpen = false;
  isNotificationsOpen = false;

  constructor() {
    // Solo cargar inicialmente si ya estamos autenticados (p. ej. al refrescar página)
    if (this.authService.isAuthenticated()) {
      this.notificationService.loadNotifications();
    }

    // Efecto reactivo para cargar notificaciones cuando el estado de autenticación cambia a TRUE
    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      if (isAuth) {
        this.notificationService.loadNotifications();
      }
    });
  }

  toggleNotifications() {
    this.isNotificationsOpen = !this.isNotificationsOpen;
  }

  markRead(notif: any) {
    if (!notif.is_read) {
      this.notificationService.markAsRead(notif.id).subscribe();
    }
    if (notif.link) {
      this.isNotificationsOpen = false;
      this.router.navigateByUrl(notif.link);
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
