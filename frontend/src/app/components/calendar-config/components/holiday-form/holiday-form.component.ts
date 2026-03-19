import { Component, input, output, effect, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Holiday, HolidayType, HolidayCreate, HolidayUpdate } from '../../../../interfaces/holiday.interface';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideHelpCircle } from '@ng-icons/lucide';

@Component({
    selector: 'app-holiday-form',
    imports: [FormsModule, NgIconComponent],
    templateUrl: './holiday-form.component.html',
    providers: [
        provideIcons({ lucideHelpCircle })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HolidayFormComponent {
    holiday = input<Holiday | null>(null); // If null, creating new
    initialDate = input<string>(''); // For new holidays initiated from a specific date

    save = output<HolidayCreate | HolidayUpdate>();
    cancel = output<void>();

    HolidayType = HolidayType;

    // Form State
    formDate = signal('');
    formName = signal('');
    formType = signal<HolidayType>(HolidayType.NATIONAL);
    formDescription = signal('');

    constructor() {
        effect(() => {
            const h = this.holiday();
            if (h) {
                this.formDate.set(h.date);
                this.formName.set(h.name);
                this.formType.set(h.holiday_type);
                this.formDescription.set(h.description || '');
            } else {
                this.formDate.set(this.initialDate() || '');
                this.formName.set('');
                this.formType.set(HolidayType.NATIONAL);
                this.formDescription.set('');
            }
        });
    }

    onSubmit() {
        const payload = {
            date: this.formDate(),
            name: this.formName(),
            holiday_type: this.formType(),
            description: this.formDescription()
        };
        this.save.emit(payload);
    }
}
