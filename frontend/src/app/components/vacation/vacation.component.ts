import { Component, signal, linkedSignal, inject, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { VacationService, VacationBalance, ResponsibleUser } from '../../services/vacation.service';
import { ConvenioService, ConvenioConfig } from '../../services/convenio.service';
import { LeaveTypeService, LeaveType } from '../../services/leave-type.service';
import { VacationRequest, Holiday, VacationRequestDraft } from '../../models/app.models';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CalendarDay } from './vacation.types';
import { VacationBalancesComponent } from './components/vacation-balances/vacation-balances.component';
import { VacationCalendarComponent } from './components/vacation-calendar/vacation-calendar.component';
import { VacationListComponent } from './components/vacation-list/vacation-list.component';
import { VacationDynamicFormComponent } from './components/vacation-dynamic-form/vacation-dynamic-form.component';
import { DialogService } from '../../services/dialog.service';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-vacation',
  imports: [
    VacationBalancesComponent,
    VacationCalendarComponent,
    VacationListComponent,
    VacationDynamicFormComponent,
    FormsModule,
    NgIconComponent,
    DatePipe,
    DecimalPipe
  ],
  templateUrl: './vacation.component.html',
  styleUrl: './vacation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacationComponent {
  private readonly vacationService = inject(VacationService);
  private readonly convenioService = inject(ConvenioService);
  private readonly leaveTypeService = inject(LeaveTypeService);
  readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);

  readonly currentYear = signal(new Date().getFullYear());

  // --- Resources API ---
  readonly requestsResource = rxResource({
    stream: () => this.vacationService.getMyRequests()
  });

  readonly balanceResource = rxResource({
    stream: () => this.vacationService.getBalance()
  });

  readonly leaveTypesResource = rxResource({
    stream: () => this.leaveTypeService.getLeaveTypes(true)
  });

  readonly convenioConfigResource = rxResource({
    stream: () => this.convenioService.getAllConfigs()
  });
  readonly holidaysResource = rxResource({
    stream: () => forkJoin([
      this.vacationService.getHolidays(this.currentYear() - 1),
      this.vacationService.getHolidays(this.currentYear()),
      this.vacationService.getHolidays(this.currentYear() + 1)
    ])
  });
  
  readonly managedRequestsResource = rxResource({
    stream: () => this.vacationService.getManagedRequests()
  });

  readonly managedStatsResource = rxResource({
    stream: () => this.vacationService.getManagedStats()
  });

  // --- Computed States ---
  readonly requests = computed(() => this.requestsResource.value() ?? []);
  readonly managedRequests = computed(() => this.managedRequestsResource.value() ?? []);
  readonly managedStats = computed(() => this.managedStatsResource.value() ?? { total: 0, pending: 0, approved: 0, rejected: 0 });
  readonly balance = computed(() => this.balanceResource.value() ?? null);
  readonly leaveTypes = computed(() => this.leaveTypesResource.value() ?? []);
  
  readonly canManage = computed(() => {
    const user = this.authService.user();
    return user?.role === 'superadmin' || user?.role === 'rrhh' || (user?.managed_users_count ?? 0) > 0;
  });

  readonly convenioConfig = computed(() => {
    const configs = this.convenioConfigResource.value();
    if (!configs) return null;
    const now = new Date().toISOString().split('T')[0];
    return configs.find(c => now >= c.valid_from && now <= c.valid_to) ?? configs[0] ?? null;
  });

  readonly holidays = computed(() => {
    const data = this.holidaysResource.value() as any[];
    if (!data || !Array.isArray(data)) return [];
    const all = [...(data[0] || []), ...(data[1] || []), ...(data[2] || [])];
    return Array.from(new Map(all.map((h: any) => [h.id, h])).values());
  });

  // --- UI State ---
  readonly loading = signal(false);
  readonly selectedRange = signal<{start: CalendarDay, end: CalendarDay} | null>(null);
  readonly selectedRequest = signal<VacationRequest | null>(null);
  readonly selectedPolicyId = signal<string | null>(null);
  readonly modalForceOpen = signal(false);
  readonly selectedTab = signal<'mine' | 'team'>('mine');

  // El estado del modal pasa a ser puramente para Edición manual, no auto-popup por seleccionar
  readonly isModalOpen = computed(() => this.modalForceOpen());

  // --- Form State (linkedSignal para reseteo automático) ---
  readonly newRequest = linkedSignal<{start: CalendarDay, end: CalendarDay} | null, VacationRequestDraft>({
    source: this.selectedRange,
    computation: (range) => {
      if (!range) {
        return {
          id: '', request_type: 'vacaciones', leave_type_id: '', start_date: '', end_date: '',
          days_requested: 1, assigned_manager_id: '', assigned_rrhh_id: '', description: '', file_url: '', attachments: []
        };
      }
      
      const s = range.start.date;
      const e = range.end.date;
      
      const startStr = `${s.getFullYear()}-${(s.getMonth() + 1).toString().padStart(2, '0')}-${s.getDate().toString().padStart(2, '0')}T08:00`;
      const endStr = `${e.getFullYear()}-${(e.getMonth() + 1).toString().padStart(2, '0')}-${e.getDate().toString().padStart(2, '0')}T18:00`;
      
      const diffTime = Math.abs(e.getTime() - s.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      return {
        id: '', request_type: 'vacaciones', leave_type_id: '', start_date: startStr, end_date: endStr,
        days_requested: diffDays, assigned_manager_id: '', assigned_rrhh_id: '', description: '', file_url: '', attachments: []
      };
    }
  });

  readonly managers = computed(() => this.authService.user()?.managers ?? []);

  readonly isMaternityVisible = computed(() => {
    const bal = this.balance()?.balances.find(b => b.slug === 'maternidad_paternidad');
    return bal ? (bal.used_days > 0.01 || bal.pending_days > 0.01) : false;
  });

  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  readonly calendarMonths = computed(() => {
    const year = this.currentYear();
    const requests = this.requests();
    const holidays = this.holidays();

    return this.monthNames.map((name, month) => {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const days: CalendarDay[] = [];

      const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ date: new Date(year, month, 0), day: 0, isToday: false, isWeekend: false });
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        days.push({
          date,
          day,
          isToday: this.checkIsToday(date),
          isWeekend,
          holiday: holidays.find(h => h.date === dateStr),
          request: requests.find(r => {
            const start = new Date(r.start_date).toISOString().split('T')[0];
            const end = new Date(r.end_date).toISOString().split('T')[0];
            return dateStr >= start && dateStr <= end;
          })
        });
      }
      return { month, name, days };
    });
  });

  private checkIsToday(d: Date): boolean {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }

  changeYear(delta: number): void {
    this.currentYear.update(y => y + delta);
  }

  setPolicy(id: string | null): void {
    this.selectedPolicyId.set(id);
  }

  openRangeModal(range: {start: CalendarDay, end: CalendarDay}): void {
    this.selectedRange.set(range);
    
    // Auto scroll down to the bottom form smoothly
    setTimeout(() => {
        document.getElementById('new-request-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  closeDayModal(): void {
    this.selectedRange.set(null);
    this.modalForceOpen.set(false);
  }

  resetNewRequest(): void {
    this.selectedRange.set(null);
  }

  openRequestDetails(request: VacationRequest): void {
    this.selectedRequest.set(request);
  }

  closeRequestDetails(): void {
    this.selectedRequest.set(null);
  }

  editRequest(req: VacationRequest): void {
    this.closeRequestDetails();
    this.newRequest.set({
      id: req.id,
      request_type: req.request_type,
      leave_type_id: req.leave_type_id ?? '',
      start_date: req.start_date,
      end_date: req.end_date ?? '',
      days_requested: req.days_requested,
      assigned_manager_id: req.assigned_manager_id ?? '',
      assigned_rrhh_id: req.assigned_rrhh_id ?? '',
      description: req.description ?? '',
      file_url: req.file_url ?? '',
      attachments: req.attachments ?? []
    } as any);
    this.selectedPolicyId.set(req.policy_id ?? null);
    this.modalForceOpen.set(true);
  }

  async sendRequestNow(req: VacationRequest) {
    const confirmed = await this.dialogService.question(
      'Enviar Solicitud',
      '¿Estás seguro de enviar esta solicitud? Una vez enviada se notificará a tu responsable para su validación.'
    );
    if (!confirmed) return;

    this.loading.set(true);
    this.vacationService.submitExistingRequest(req.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.closeRequestDetails();
        this.requestsResource.reload();
        this.balanceResource.reload();
      },
      error: () => this.loading.set(false)
    });
  }

  async deleteRequest(req: VacationRequest) {
    const confirmed = await this.dialogService.danger(
      'Eliminar Solicitud',
      '¿Estás seguro de eliminar esta solicitud? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    this.loading.set(true);
    this.vacationService.deleteRequest(req.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.closeRequestDetails();
        this.requestsResource.reload();
        this.balanceResource.reload();
      },
      error: () => this.loading.set(false)
    });
  }

  async submitRequest(event: { request: VacationRequestDraft, files: { file: File, url: string }[] }) {
    this.loading.set(true);
    this.newRequest.set(event.request);

    try {
      let uploadedAttachments: any[] = [];
      if (event.files.length > 0) {
        uploadedAttachments = await this.uploadFilesSequentially(event.files);
      }

      const payload: any = {
        ...event.request,
        attachments: [...(event.request.attachments || []), ...uploadedAttachments]
      };

      if (payload.end_date === '') delete payload.end_date;

      const obs = payload.id
        ? this.vacationService.updateRequest(payload.id, payload)
        : this.vacationService.createRequest(payload);

      obs.subscribe({
        next: () => {
          this.loading.set(false);
          this.resetNewRequest();
          this.closeDayModal();
          this.requestsResource.reload();
          this.balanceResource.reload();
        },
        error: () => this.loading.set(false)
      });

    } catch (e) {
      console.error(e);
      this.loading.set(false);
      alert("Error subiendo archivos");
    }
  }

  async uploadFilesSequentially(files: { file: File }[]): Promise<{ file_url: string, file_original_name: string }[]> {
    const uploaded: { file_url: string, file_original_name: string }[] = [];
    for (const f of files) {
      const res = await new Promise<any>((resolve, reject) => {
        this.vacationService.uploadFile(f.file).subscribe({ next: resolve, error: reject });
      });
      uploaded.push({ file_url: res.url, file_original_name: res.original_filename });
    }
    return uploaded;
  }

  toggleTab(tab: 'mine' | 'team'): void {
    this.selectedTab.set(tab);
    if (tab === 'team') {
      this.managedRequestsResource.reload();
      this.managedStatsResource.reload();
    } else {
      this.requestsResource.reload();
      this.balanceResource.reload();
    }
  }

  async approveRequest(req: VacationRequest) {
    const userRole = this.authService.user()?.role;
    const isRRHH = userRole === 'rrhh' || userRole === 'superadmin';
    const actionStr = isRRHH ? 'Aprobar definitivamente' : 'Validar como Responsable';
    
    const confirmed = await this.dialogService.question(
      actionStr,
      `¿Estás seguro de validar esta solicitud de ${req.user_name || 'empleado'}?`
    );
    if (!confirmed) return;

    this.loading.set(true);
    const obs = isRRHH 
      ? this.vacationService.approveRRHH(req.id)
      : this.vacationService.approveManager(req.id);
      
    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.closeRequestDetails();
        this.managedRequestsResource.reload();
        this.managedStatsResource.reload();
        this.requestsResource.reload();
      },
      error: () => this.loading.set(false)
    });
  }

  async rejectRequest(req: VacationRequest) {
    const reason = prompt('Indica el motivo del rechazo:');
    if (reason === null) return;
    if (!reason.trim()) {
        alert('El motivo es obligatorio');
        return;
    }

    const userRole = this.authService.user()?.role;
    const isRRHH = userRole === 'rrhh' || userRole === 'superadmin';
    this.loading.set(true);
    const obs = isRRHH
      ? this.vacationService.rejectRRHH(req.id, reason)
      : this.vacationService.rejectManager(req.id, reason);

    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.closeRequestDetails();
        this.managedRequestsResource.reload();
        this.managedStatsResource.reload();
      },
      error: () => this.loading.set(false)
    });
  }
}
