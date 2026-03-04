import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// Components
import { ComplaintFormComponent } from './components/complaint-form/complaint-form.component';
import { ComplaintLookupComponent } from './components/complaint-lookup/complaint-lookup.component';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-complaint',
  imports: [CommonModule, ComplaintFormComponent, ComplaintLookupComponent, NgIconComponent],
  templateUrl: './complaint.component.html',
  styleUrl: './complaint.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintComponent {
  private router = inject(Router);

  onSuccessNavigation(event: { code: string, token: string }): void {
    this.router.navigate(['/complaint/status', event.code], { queryParams: { token: event.token } });
  }

  onLookup(event: { code: string, token: string }): void {
    this.router.navigate(['/complaint/status', event.code], { queryParams: { token: event.token } });
  }
}
