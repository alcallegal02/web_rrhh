import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserFormModel } from '../../user-form.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBriefcase, lucideHelpCircle } from '@ng-icons/lucide';

@Component({
    selector: 'app-user-contract-info',
    imports: [FormsModule, NgIconComponent, UpperCasePipe],
    templateUrl: './user-contract-info.component.html',
    providers: [
        provideIcons({ lucideBriefcase, lucideHelpCircle })
    ]
})
export class UserContractInfoComponent {
    // Inputs
    form = input.required<UserFormModel>();
    roles = input<string[]>([]);
    contractType = input<'indefinite' | 'temporary'>('indefinite');

    // Outputs
    fieldChange = output<{ field: string; value: any }>();
    contractTypeChange = output<'indefinite' | 'temporary'>();
    expirationDateChange = output<string>();

    updateField(field: string, value: any): void {
        this.fieldChange.emit({ field, value });
    }

    onContractTypeChange(type: 'indefinite' | 'temporary'): void {
        this.contractTypeChange.emit(type);
    }

    onExpirationDateChange(date: string): void {
        this.expirationDateChange.emit(date);
    }
}
