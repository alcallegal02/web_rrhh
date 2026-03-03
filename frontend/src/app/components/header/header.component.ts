import { Component, inject, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common'; // Still needed for pipes if any, though imports array in standalone handles component visibility
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule, UserProfileModalComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
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

  logout(): void {
    this.authService.logout();
  }
}
