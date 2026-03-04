import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';

export interface DashboardVacationRequest {
    id: string;
    request_type: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    status: string;
    user_name?: string;
    [key: string]: any;
}

@Component({
    selector: 'app-pending-requests-widget',
    imports: [CommonModule, FormsModule, DatePipe, NgIconComponent],
    templateUrl: './pending-requests-widget.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PendingRequestsWidgetComponent {
    requests = input.required<DashboardVacationRequest[]>();
    processingId = input<string | null>(null);

    approve = output<string>();
    reject = output<{ id: string, reason: string }>();

    // Dialog State
    showRejectDialog = signal(false);
    rejectReason = signal('');
    currentRejectId = signal<string | null>(null);

    getStatusLabel(status: string): string {
        const labels: { [key: string]: string } = {
            'borrador': 'Borrador',
            'pending': 'Pendiente',
            'approved_manager': 'Aprobado por Manager',
            'rejected_manager': 'Rechazado por Manager',
            'approved_rrhh': 'Aprobado por RRHH',
            'rejected_rrhh': 'Rechazado por RRHH',
            'accepted': 'Aceptada',
            'rejected': 'Rechazada'
        };
        return labels[status] || status;
    }

    getStatusClass(status: string): string {
        const classes: { [key: string]: string } = {
            'borrador': 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm',
            'pending': 'px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm',
            'approved_manager': 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm',
            'rejected_manager': 'px-2 py-1 bg-red-100 text-red-800 rounded text-sm',
            'approved_rrhh': 'px-2 py-1 bg-green-100 text-green-800 rounded text-sm',
            'rejected_rrhh': 'px-2 py-1 bg-red-100 text-red-800 rounded text-sm',
            'accepted': 'px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-semibold',
            'rejected': 'px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-semibold'
        };
        return classes[status] || 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm';
    }

    // Actions
    onApprove(id: string) {
        this.approve.emit(id);
    }

    openRejectDialog(id: string) {
        this.currentRejectId.set(id);
        this.rejectReason.set('');
        this.showRejectDialog.set(true);
    }

    closeRejectDialog() {
        this.showRejectDialog.set(false);
        this.currentRejectId.set(null);
    }

    confirmReject() {
        const id = this.currentRejectId();
        if (id && this.rejectReason()) {
            this.reject.emit({ id, reason: this.rejectReason() });
            this.closeRejectDialog();
        }
    }
}
