import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VacationRequest } from '../../../../models/app.models';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-my-requests-status-widget',
  imports: [CommonModule, RouterModule, NgIconComponent],
  templateUrl: './my-requests-status-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyRequestsStatusWidgetComponent {
  requests = input<VacationRequest[]>([]);

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'borrador': 'Borrador',
      'pending': 'Pendiente',
      'approved_manager': 'Pendiente RRHH',
      'rejected_manager': 'Rechazado Mánager',
      'approved_rrhh': 'Aprobada',
      'rejected_rrhh': 'Rechazada RRHH',
      'accepted': 'Aceptada',
      'rejected': 'Rechazada'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const common = 'border';
    if (status === 'pending' || status === 'borrador') return `${common} bg-yellow-50 text-yellow-600 border-yellow-100`;
    if (status.includes('approved') || status === 'accepted') return `${common} bg-green-50 text-green-600 border-green-100`;
    if (status.includes('rejected') || status === 'rejected') return `${common} bg-red-50 text-red-600 border-red-100`;
    return `${common} bg-gray-50 text-gray-500 border-gray-100`;
  }
}
