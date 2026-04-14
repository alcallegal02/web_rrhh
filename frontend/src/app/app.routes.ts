import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { authGuard } from './guards/auth.guard';
import { rrhhGuard } from './guards/rrhh.guard';
import { adminGuard } from './guards/admin.guard';

import { loginGuard } from './guards/login.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    data: { title: 'Dashboard' }
  },
  {
    path: 'vacation',
    loadComponent: () => import('./components/vacation/vacation.component').then(m => m.VacationComponent),
    canActivate: [authGuard],
    data: { title: 'Vacaciones' }
  },
  {
    path: 'requests-management',
    loadComponent: () => import('./components/employee-requests/employee-requests.component').then(m => m.EmployeeRequestsComponent),
    canActivate: [authGuard],
    data: { title: 'Gestión de Solicitudes' }
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
    canActivate: [() => inject(AuthService).canManageUsers() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Usuarios' }
  },
  {
    path: 'org-chart',
    loadComponent: () => import('./components/org-chart/org-chart.component').then(m => m.OrgChartComponent),
    canActivate: [authGuard],
    data: { title: 'Organigrama' }
  },
  {
    path: 'news',
    loadComponent: () => import('./components/news/components/news-archive/news-archive.component').then(m => m.NewsArchiveComponent),
    canActivate: [authGuard],
    data: { title: 'Noticias' }
  },
  {
    path: 'news/manage',
    loadComponent: () => import('./components/news/news.component').then(m => m.NewsComponent),
    canActivate: [() => inject(AuthService).canManageNews() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Gestión de Noticias' }
  },
  {
    path: 'news/:id',
    loadComponent: () => import('./components/news/components/news-detail/news-detail.component').then(m => m.NewsDetailComponent),
    canActivate: [authGuard],
    data: { title: 'Detalle de Noticia' }
  },
  {
    path: 'complaint/admin',
    loadComponent: () => import('./components/complaint/pages/management/complaint-management.component').then(m => m.ComplaintManagementComponent),
    canActivate: [() => inject(AuthService).canManageComplaints() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Gestión de Denuncias' }
  },
  {
    path: 'calendar-config',
    loadComponent: () => import('./components/calendar-config/calendar-config.component').then(m => m.CalendarConfigComponent),
    canActivate: [() => inject(AuthService).canManageHolidays() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Configuración Calendario' }
  },
  {
    path: 'complaint',
    loadComponent: () => import('./components/complaint/complaint.component').then(m => m.ComplaintComponent),
    data: { title: 'Canal de Denuncias' }
  },
  {
    path: 'complaint/status',
    loadComponent: () => import('./components/complaint/pages/status/complaint-status.component').then(m => m.ComplaintStatusComponent),
    data: { title: 'Estado de Denuncia' }
  },
  {
    path: 'complaint/status/:code',
    loadComponent: () => import('./components/complaint/pages/status/complaint-status.component').then(m => m.ComplaintStatusComponent),
    data: { title: 'Estado de Denuncia' }
  },
  {
    path: 'audit',
    loadComponent: () => import('./components/audit/audit.component').then(m => m.AuditComponent),
    canActivate: [() => inject(AuthService).isSuperadmin() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Auditoría' }
  },
  {
    path: 'config/absence-types',
    loadComponent: () => import('./components/config/policy-config/policy-config.component').then(m => m.PolicyConfigComponent),
    canActivate: [() => inject(AuthService).isSuperadmin() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Tipos de Ausencia' }
  },
  {
    path: 'config/absence-types/:id',
    loadComponent: () => import('./components/config/policy-config/policy-form/policy-form.component').then(m => m.PolicyFormComponent),
    canActivate: [() => inject(AuthService).isSuperadmin() || inject(Router).createUrlTree(['/dashboard'])],
    data: { title: 'Editar Tipo de Ausencia' }
  },
  { path: '**', redirectTo: '/login' }
];

