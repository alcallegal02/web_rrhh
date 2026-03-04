import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, User } from '../../../services/auth.service';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-login',
  imports: [FormsModule, NgIconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Signals for reactive state management
  readonly credentials = signal({
    username: '',
    password: ''
  });

  readonly loading = signal(false);
  readonly error = signal('');
  readonly infoMessage = signal('');

  ngOnInit(): void {
    const expired = this.route.snapshot.queryParamMap.get('expired');
    if (expired === 'true') {
      this.infoMessage.set('Tu sesión ha expirado, por favor inicia sesión de nuevo');
    }
  }

  onSubmit(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set('');
    this.infoMessage.set('');

    this.authService.login(this.credentials()).subscribe({
      next: (_user: User) => {
        this.loading.set(false);
        // Using window.location to strictly force a refresh is sometimes needed for auth state reset,
        // but typically router.navigate is preferred in SPAs. Keeping original logic but clean.
        window.location.href = '/dashboard';
      },
      error: (err: unknown) => {
        // Safe access to error structure
        const errorMessage = (err as any)?.error?.detail || 'Error al iniciar sesión';
        this.error.set(errorMessage);
        this.loading.set(false);
      }
    });
  }

  updateUsername(value: string): void {
    this.credentials.update(creds => ({ ...creds, username: value }));
  }

  updatePassword(value: string): void {
    this.credentials.update(creds => ({ ...creds, password: value }));
  }
}
