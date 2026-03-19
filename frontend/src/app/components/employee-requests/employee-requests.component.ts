import { Component, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { VacationService } from '../../services/vacation.service';
import { VacationRequest } from '../../models/app.models';
import { NgIconComponent } from '@ng-icons/core';
import { of } from 'rxjs';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-employee-requests',
  imports: [FormsModule, NgIconComponent, StatusBadgeComponent, DatePipe, TitleCasePipe],
  templateUrl: './employee-requests.component.html',
  styleUrl: './employee-requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeRequestsComponent {
  public readonly authService = inject(AuthService);
  private readonly vacationService = inject(VacationService);

  // Top level tabs: 'personal' | 'team'
  readonly activeMainTab = signal<'personal' | 'team'>('personal');

  // Team sub-tabs for RRHH: 'work' | 'hr' 
  readonly activeTeamTab = signal<'work' | 'hr'>('work');

  // --- Resources API ---
  readonly myRequestsResource = rxResource<VacationRequest[], unknown>({
    stream: () => this.vacationService.getMyRequests()
  });

  readonly managerRequestsResource = rxResource<VacationRequest[], unknown>({
    stream: () => this.vacationService.getPendingManagerRequests()
  });

  readonly rrhhRequestsResource = rxResource<VacationRequest[], unknown>({
    stream: () => {
      if (this.authService.isRRHH() || this.authService.isSuperadmin()) {
        return this.vacationService.getPendingRRHHRequests();
      }
      return of([] as VacationRequest[]);
    }
  });

  // --- Computed States ---
  readonly myRequests = computed(() => this.myRequestsResource.value() ?? []);
  readonly managerRequests = computed(() => this.managerRequestsResource.value() ?? []);
  readonly rrhhRequests = computed(() => this.rrhhRequestsResource.value() ?? []);

  readonly loadingPersonal = computed(() => this.myRequestsResource.isLoading());
  readonly loadingManager = computed(() => this.managerRequestsResource.isLoading());
  readonly loadingRRHH = computed(() => this.rrhhRequestsResource.isLoading());

  readonly totalTeamPending = computed(() => this.managerRequests().length + this.rrhhRequests().length);

  getStatusVariant(status: string): any {
    const variants: Record<string, string> = {
      'approved_rrhh': 'success',
      'pending': 'warning',
      'approved_manager': 'indigo',
      'rejected_manager': 'error',
      'rejected_rrhh': 'error',
      'borrador': 'neutral'
    };
    return variants[status] || 'neutral';
  }

  readonly processing = signal<string | null>(null);

  // --- Actions ---
  approveManager(req: VacationRequest) {
    if (!req.user_name || !confirm(`¿Aprobar solicitud de ${req.user_name}?`)) return;

    this.processing.set(req.id);
    this.vacationService.approveManager(req.id).subscribe({
        next: () => {
          this.processing.set(null);
          this.managerRequestsResource.reload();
        },
        error: () => this.processing.set(null)
      });
  }

  rejectManager(req: VacationRequest) {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    this.processing.set(req.id);
    this.vacationService.rejectManager(req.id, reason).subscribe({
        next: () => {
          this.processing.set(null);
          this.managerRequestsResource.reload();
        },
        error: () => this.processing.set(null)
      });
  }

  approveRRHH(req: VacationRequest) {
    if (!req.user_name || !confirm(`¿Aprobar y finalizar solicitud de ${req.user_name}?`)) return;

    this.processing.set(req.id);
    this.vacationService.approveRRHH(req.id).subscribe({
        next: () => {
          this.processing.set(null);
          this.rrhhRequestsResource.reload();
        },
        error: () => this.processing.set(null)
      });
  }

  rejectRRHH(req: VacationRequest) {
    const reason = prompt('Motivo del rechazo final:');
    if (!reason) return;

    this.processing.set(req.id);
    this.vacationService.rejectRRHH(req.id, reason).subscribe({
        next: () => {
          this.processing.set(null);
          this.rrhhRequestsResource.reload();
        },
        error: () => this.processing.set(null)
      });
  }
}
