import { Component, input, output, ChangeDetectionStrategy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import * as ComplaintUtils from '../../utils/complaint.utils';
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
  imports: [NgIconComponent, DatePipe],
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

  // Status Utility Mappings (Exposed for template)
  readonly getStatusIcon = ComplaintUtils.getStatusIcon;
  readonly getStatusIconColor = ComplaintUtils.getStatusIconColor;
  readonly getStatusLabel = ComplaintUtils.getStatusLabel;
  readonly getStatusClass = ComplaintUtils.getStatusClass;
  readonly getStatusStripeClass = ComplaintUtils.getStatusStripeClass;

}
