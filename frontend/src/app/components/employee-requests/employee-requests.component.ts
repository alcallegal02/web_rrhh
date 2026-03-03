import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { VacationService } from '../../services/vacation.service';
import { VacationRequest } from '../../models/app.models';

@Component({
  selector: 'app-employee-requests',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-requests.component.html',
  styleUrl: './employee-requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeRequestsComponent implements OnInit {
  public authService = inject(AuthService);
  private vacationService = inject(VacationService);

  // Top level tabs: 'personal' | 'team'
  activeMainTab = signal<'personal' | 'team'>('personal');

  // Team sub-tabs for RRHH: 'work' | 'hr' 
  // For managers it will just be 'direct' (effectively 'work')
  activeTeamTab = signal<'work' | 'hr'>('work');

  myRequests = signal<VacationRequest[]>([]);
  managerRequests = signal<VacationRequest[]>([]); // These are 'Work' responsibility
  rrhhRequests = signal<VacationRequest[]>([]); // These are 'HR' responsibility

  loadingPersonal = signal(false);
  loadingManager = signal(false);
  loadingRRHH = signal(false);
  processing = signal<string | null>(null);

  ngOnInit() {
    this.loadMyRequests();

    // If user has subordinates or is RRHH, they might have 'team' tab available
    // For now we load them if they have roles, but logic will hide tabs if empty
    this.loadManagerRequests();
    if (this.authService.isRRHH() || this.authService.isSuperadmin()) {
      this.loadRRHHRequests();
    }

    // Default to 'team' if there are pending team requests and no personal history? 
    // Actually personal history is usually more important as 'Dashboard' style.
  }

  loadMyRequests() {
    this.loadingPersonal.set(true);
    this.vacationService.getMyRequests()
      .subscribe({
        next: (data) => {
          this.myRequests.set(data);
          this.loadingPersonal.set(false);
        },
        error: () => this.loadingPersonal.set(false)
      });
  }

  loadManagerRequests() {
    this.loadingManager.set(true);
    this.vacationService.getPendingManagerRequests()
      .subscribe({
        next: (data) => {
          this.managerRequests.set(data);
          this.loadingManager.set(false);
        },
        error: () => this.loadingManager.set(false)
      });
  }

  loadRRHHRequests() {
    this.loadingRRHH.set(true);
    this.vacationService.getPendingRRHHRequests()
      .subscribe({
        next: (data) => {
          this.rrhhRequests.set(data);
          this.loadingRRHH.set(false);
        },
        error: () => this.loadingRRHH.set(false)
      });
  }

  approveManager(req: VacationRequest) {
    if (!req.user_name) return; // Should allow if defined
    if (!confirm('¿Aprobar solicitud de ' + req.user_name + '?')) return;

    this.processing.set(req.id);
    this.vacationService.approveManager(req.id)
      .subscribe({
        next: () => {
          this.processing.set(null);
          this.loadManagerRequests();
        },
        error: () => {
          this.processing.set(null);
          alert('Error al aprobar');
        }
      });
  }

  rejectManager(req: VacationRequest) {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    this.processing.set(req.id);
    this.vacationService.rejectManager(req.id, reason)
      .subscribe({
        next: () => {
          this.processing.set(null);
          this.loadManagerRequests();
        },
        error: () => {
          this.processing.set(null);
          alert('Error al rechazar');
        }
      });
  }

  approveRRHH(req: VacationRequest) {
    if (!req.user_name) return;
    if (!confirm('¿Aprobar y finalizar solicitud de ' + req.user_name + '?')) return;

    this.processing.set(req.id);
    this.vacationService.approveRRHH(req.id)
      .subscribe({
        next: () => {
          this.processing.set(null);
          this.loadRRHHRequests();
        },
        error: () => {
          this.processing.set(null);
          alert('Error al aprobar');
        }
      });
  }

  rejectRRHH(req: VacationRequest) {
    const reason = prompt('Motivo del rechazo final:');
    if (!reason) return;

    this.processing.set(req.id);
    this.vacationService.rejectRRHH(req.id, reason)
      .subscribe({
        next: () => {
          this.processing.set(null);
          this.loadRRHHRequests();
        },
        error: () => {
          this.processing.set(null);
          alert('Error al rechazar');
        }
      });
  }
}
