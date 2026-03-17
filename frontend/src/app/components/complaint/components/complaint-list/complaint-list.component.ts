import { Component, input, output, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Complaint } from '../../../../models/app.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { 
    lucideScale, lucideCalendarDays, lucideChevronRight, 
    lucideClock, lucideTrash2, lucideMessageCircle, 
    lucideShield, lucideUser, lucideSearch, lucideShieldAlert,
    lucideMessageSquareText, lucideCheckCircle, lucideXCircle,
    lucidePackageCheck, lucideChevronDown
} from '@ng-icons/lucide';

@Component({
  selector: 'app-complaint-list',
  standalone: true,
  imports: [CommonModule, DatePipe, NgIconComponent],
  templateUrl: './complaint-list.component.html',
  styleUrl: './complaint-list.component.scss',
  providers: [
    provideIcons({ 
        lucideScale, lucideCalendarDays, lucideChevronRight, 
        lucideClock, lucideTrash2, lucideMessageCircle, 
        lucideShield, lucideUser, lucideSearch, lucideShieldAlert,
        lucideMessageSquareText, lucideCheckCircle, lucideXCircle,
        lucidePackageCheck, lucideChevronDown
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintListComponent {
  complaints = input.required<Complaint[]>();
  selectedId = input<string | null>(null);
  statusOptions = input<{ value: string, label: string, icon: string, iconColor: string }[]>([]);
  
  select = output<Complaint>();
  delete = output<string>();
  statusChange = output<{ complaintId: string, newStatus: string }>();

  activeStatusDropdownId = signal<string | null>(null);

  toggleStatusDropdown(event: Event, complaintId: string): void {
    event.stopPropagation();
    if (this.activeStatusDropdownId() === complaintId) {
      this.activeStatusDropdownId.set(null);
    } else {
      this.activeStatusDropdownId.set(complaintId);
    }
  }

  changeStatus(complaintId: string, newStatus: string): void {
    this.statusChange.emit({ complaintId, newStatus });
    this.activeStatusDropdownId.set(null);
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'entregada': 'Entregada',
      'pendiente': 'Pendiente',
      'en_analisis': 'En Análisis',
      'en_investigacion': 'En Investigación',
      'informacion_requerida': 'Información Requerida',
      'resuelta': 'Resuelta',
      'desestimada': 'Desestimada'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'entregada': 'lucidePackageCheck',
      'pendiente': 'lucideClock',
      'en_analisis': 'lucideSearch',
      'en_investigacion': 'lucideShieldAlert',
      'informacion_requerida': 'lucideMessageSquareText',
      'resuelta': 'lucideCheckCircle',
      'desestimada': 'lucideXCircle'
    };
    return icons[status] || 'lucideScale';
  }

  getStatusIconColor(status: string): string {
    const colors: { [key: string]: string } = {
      'entregada': 'text-gray-400',
      'pendiente': 'text-amber-500',
      'en_analisis': 'text-blue-500',
      'en_investigacion': 'text-purple-500',
      'informacion_requerida': 'text-orange-500',
      'resuelta': 'text-emerald-500',
      'desestimada': 'text-red-500'
    };
    return colors[status] || 'text-gray-400';
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'entregada': 'bg-gray-50 text-gray-700 border-gray-200',
      'pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
      'en_analisis': 'bg-blue-50 text-blue-700 border-blue-200',
      'en_investigacion': 'bg-purple-50 text-purple-700 border-purple-200',
      'informacion_requerida': 'bg-orange-50 text-orange-700 border-orange-200',
      'resuelta': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'desestimada': 'bg-red-50 text-red-700 border-red-200'
    };
    return classes[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  }

  getStatusStripeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'entregada': 'bg-gray-300',
      'pendiente': 'bg-amber-400',
      'en_analisis': 'bg-blue-500',
      'en_investigacion': 'bg-purple-500',
      'informacion_requerida': 'bg-orange-500',
      'resuelta': 'bg-emerald-500',
      'desestimada': 'bg-red-500'
    };
    return classes[status] || 'bg-gray-300';
  }
}
