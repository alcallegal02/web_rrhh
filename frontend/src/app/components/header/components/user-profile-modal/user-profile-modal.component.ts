import { Component, inject, signal, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../config/environment';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-user-profile-modal',
    imports: [FormsModule, NgIconComponent],
    templateUrl: './user-profile-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserProfileModalComponent {
    isOpen = input(false);
    user = input<any>(null);
    closeEvent = output<void>();

    private http = inject(HttpClient);

    step = signal<'idle' | 'verify_otp' | 'reset_password'>('idle');
    loading = signal(false);
    message = '';
    error = false;

    otp = '';
    newPassword = '';
    confirmPassword = '';

    close() {
        this.closeEvent.emit();
        this.resetState();
    }

    resetState() {
        this.step.set('idle');
        this.message = '';
        this.error = false;
        this.otp = '';
        this.newPassword = '';
        this.confirmPassword = '';
    }

    requestOtp() {
        this.loading.set(true);
        this.message = '';
        this.error = false;

        this.http.post(`${environment.apiUrl}/auth/request-password-change`, {}).subscribe({
            next: () => {
                this.loading.set(false);
                this.step.set('verify_otp');
                this.message = 'Código enviado a tu correo. Revísalo.';
                this.error = false;
            },
            error: (err) => {
                this.loading.set(false);
                this.message = err.error?.detail || 'Error al solicitar código';
                this.error = true;
            }
        });
    }

    verifyOtp() {
        this.loading.set(true);
        this.message = '';
        this.error = false;

        this.http.post(`${environment.apiUrl}/auth/check-password-reset-otp`, { otp: this.otp }).subscribe({
            next: () => {
                this.loading.set(false);
                this.step.set('reset_password');
                this.message = 'Código verificado. Introduce tu nueva contraseña.';
                this.error = false;
            },
            error: (err) => {
                this.loading.set(false);
                this.message = err.error?.detail || 'Código inválido o expirado';
                this.error = true;
            }
        });
    }

    confirmChange() {
        this.loading.set(true);
        this.message = '';
        this.error = false;

        this.http.post(`${environment.apiUrl}/auth/confirm-password-change`, {
            otp: this.otp,
            new_password: this.newPassword
        }).subscribe({
            next: () => {
                this.loading.set(false);
                this.message = '¡Contraseña cambiada correctamente!';
                this.error = false;
                setTimeout(() => {
                    this.close();
                    // Optional: logout
                }, 2000);
            },
            error: (err) => {
                this.loading.set(false);
                this.message = err.error?.detail || 'Error al cambiar contraseña';
                this.error = true;
            }
        });
    }
}
