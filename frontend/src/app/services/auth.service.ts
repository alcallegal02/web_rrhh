import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, switchMap, of } from 'rxjs';
import { environment } from '../config/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export type Role = 'superadmin' | 'rrhh' | 'empleado';

export interface UserAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  upload_date: string;
}

export type UserResponse = User;

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  managers: { id: string; full_name: string }[];
  rrhh_responsible_id?: string;
  department_id?: string;
  position_id?: string;
  photo_url?: string;
  is_active: boolean;
  vac_days: number;
  vac_hours: number;
  asuntos_propios_days: number;
  asuntos_propios_hours: number;
  dias_compensados_days: number;
  dias_compensados_hours: number;
  med_gral_days: number;
  med_gral_hours: number;
  med_especialista_days: number;
  med_especialista_hours: number;
  licencia_retribuida_days: number;
  licencia_retribuida_hours: number;
  bolsa_horas_days: number;
  bolsa_horas_hours: number;
  horas_sindicales_days: number;
  horas_sindicales_hours: number;
  attachments?: UserAttachment[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Inject services using inject() function (Angular 21 modern syntax)
  private http = inject(HttpClient);
  private router = inject(Router);

  private tokenKey = 'auth_token';
  private userKey = 'auth_user';

  private _token = signal<string | null>(localStorage.getItem(this.tokenKey));
  private _user = signal<User | null>(
    localStorage.getItem(this.userKey) ? JSON.parse(localStorage.getItem(this.userKey)!) : null
  );

  token = this._token.asReadonly();
  user = this._user.asReadonly();
  isAuthenticated = computed(() => this._token() !== null && this._user() !== null);

  login(credentials: LoginRequest): Observable<User> {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, formData).pipe(
      tap((response: LoginResponse) => {
        this.setToken(response.access_token);
      }),
      switchMap(() => {
        return this.loadUser();
      })
    );
  }

  logout(): void {
    // Limpieza total de datos de sesión
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    // Opcional: limpiar todo el localStorage para asegurar que no hay residuos
    // localStorage.clear(); 

    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this._token.set(token);
  }

  loadUser(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user: User) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this._user.set(user);
      })
    );
  }

  getToken(): string | null {
    return this._token();
  }

  hasRole(role: 'superadmin' | 'rrhh' | 'empleado'): boolean {
    return this._user()?.role === role;
  }

  isRRHH(): boolean {
    return this.hasRole('rrhh');
  }

  isAdmin(): boolean {
    return this.hasRole('superadmin');
  }

  isSuperadmin(): boolean {
    return this.hasRole('superadmin');
  }
  // Helper helper to verify session state reflects storage state
  checkSessionConsistency(): boolean {
    const storedToken = localStorage.getItem(this.tokenKey);
    const inMemoryAuth = this.isAuthenticated();

    if (inMemoryAuth && !storedToken) {
      // Token removed from storage but still in memory -> Invalid state, force logout
      this.logout();
      return false;
    }

    // If not authenticated in memory, we might want to check storage to auto-login, 
    // but the constructor signals already handle initial load.
    // So strictly for guard purposes, if inMemory is false, it returns false anyway.
    return inMemoryAuth;
  }
}
