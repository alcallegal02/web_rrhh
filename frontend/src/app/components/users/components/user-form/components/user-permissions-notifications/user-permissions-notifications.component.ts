import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideBell } from '@ng-icons/lucide';
import { UserFormModel } from '../../user-form.models';

@Component({
  selector: 'app-user-permissions-notifications',
  imports: [FormsModule, NgIconComponent],
  providers: [
    provideIcons({ lucideShieldCheck, lucideBell })
  ],
  templateUrl: './user-permissions-notifications.component.html'
})
export class UserPermissionsNotificationsComponent {
  form = input.required<UserFormModel>();
  fieldChange = output<{ field: string, value: any }>();

  updateField(field: string, value: any): void {
    this.fieldChange.emit({ field, value });
  }
}
