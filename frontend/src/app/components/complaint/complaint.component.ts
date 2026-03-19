import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

// Components
import { ComplaintFormComponent } from './components/complaint-form/complaint-form.component';
import { ComplaintLookupComponent } from './components/complaint-lookup/complaint-lookup.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMegaphone, lucideTriangleAlert, lucideShieldCheck } from '@ng-icons/lucide';

@Component({
  selector: 'app-complaint',
  imports: [ComplaintFormComponent, ComplaintLookupComponent, NgIconComponent],
  templateUrl: './complaint.component.html',
  styleUrl: './complaint.component.scss',
  providers: [
    provideIcons({ lucideMegaphone, lucideTriangleAlert, lucideShieldCheck })
  ],
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
