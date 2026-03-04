import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserFormModel, AllowanceConcept } from '../../user-form.models';
import { DurationInputComponent } from '../../../../../shared/duration-input/duration-input.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideScale, lucideHelpCircle } from '@ng-icons/lucide';

// Re-export for convenience
export { AllowanceConcept };

@Component({
    selector: 'app-user-allowances-table',
    imports: [CommonModule, FormsModule, DurationInputComponent, NgIconComponent],
    templateUrl: './user-allowances-table.component.html',
    providers: [
        provideIcons({ lucideScale, lucideHelpCircle })
    ]
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
