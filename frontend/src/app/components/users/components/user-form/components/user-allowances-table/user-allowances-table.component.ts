import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DurationInputComponent } from '../../../../../shared/duration-input/duration-input.component';
import { UserFormModel, AllowanceConcept } from '../../user-form.models';

// Re-export for convenience
export { AllowanceConcept };

@Component({
    selector: 'app-user-allowances-table',
    imports: [CommonModule, FormsModule, DurationInputComponent],
    templateUrl: './user-allowances-table.component.html'
})
export class UserAllowancesTableComponent {
    // Inputs
    form = input.required<UserFormModel>();
    concepts = input<AllowanceConcept[]>([]);

    // Outputs
    fieldChange = output<{ field: string; value: any }>();

    updateField(field: string, value: any): void {
        this.fieldChange.emit({ field, value });
    }
}
