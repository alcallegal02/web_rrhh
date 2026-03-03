import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserFormModel } from '../../user-form.models';

@Component({
    selector: 'app-user-contract-info',
    imports: [CommonModule, FormsModule],
    templateUrl: './user-contract-info.component.html'
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
