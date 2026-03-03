import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // We use checkSessionConsistency to ensure that even if the memory state is "true",
  // if the user deleted the token from localStorage, we catch it here.
  const isAuth = authService.checkSessionConsistency();

  if (isAuth) {
    return true;
  }

  // Si no está autenticado, aseguramos que se limpie cualquier rastro y redirigimos
  authService.logout();
  return false;
};

