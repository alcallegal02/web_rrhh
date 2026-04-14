import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el servidor devuelve 401 o 403, cerramos sesión
      if (error.status === 401 || error.status === 403) {
        const currentUrl = router.url;
        // Si no estamos en una ruta pública, redirigimos al login
        const isPublicRoute = currentUrl.includes('/complaint') || currentUrl === '/login' || currentUrl === '/';
        
        if (!isPublicRoute) {
          authService.logout();
          router.navigate(['/login'], { queryParams: { expired: 'true' } });
        } else {
          // En rutas públicas, solo limpiamos el estado si había un token (para evitar bucles o inconsistencias)
          if (authService.getToken()) {
            authService.logout();
          }
        }
      }
      return throwError(() => error);
    })
  );
};

