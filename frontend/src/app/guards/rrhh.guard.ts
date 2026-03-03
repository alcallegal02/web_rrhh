import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const rrhhGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const allowed = authService.isRRHH() || authService.isSuperadmin();
  if (!allowed) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};

