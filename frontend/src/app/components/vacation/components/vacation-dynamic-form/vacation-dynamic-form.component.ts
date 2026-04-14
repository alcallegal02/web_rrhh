import { Component, input, output, signal, inject, effect, computed } from '@angular/core';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { form, field } from '../../../../shared/utils/signal-forms';
import { PolicyService } from '../../../../services/policy.service';
import { ResponsibleUser, VacationService, VacationBalance } from '../../../../services/vacation.service';
import { VacationRequestDraft } from '../../vacation.types';
import { NgIconComponent } from '@ng-icons/core';

export interface FormFieldSchema {
    name: string;
    type: 'text' | 'number' | 'date' | 'datetime' | 'file' | 'textarea';
    label: string;
    required: boolean;
    helpText?: string;
    min?: number;
    max?: number;
}

export interface DynamicFormSchema {
    policy_id: string;
    name: string;
    is_paid: boolean;
    description: string;
    available_balance: number;
    unit: string;
    max_duration_per_day?: number;
    fields: FormFieldSchema[];
}

@Component({
    selector: 'app-vacation-dynamic-form',
    imports: [ReactiveFormsModule, NgIconComponent, DecimalPipe],
    templateUrl: './vacation-dynamic-form.component.html',
})
export class VacationDynamicFormComponent {
    private policyService = inject(PolicyService);

    policyId = input<string>('');
    managers = input<ResponsibleUser[]>([]);
    balance = input<VacationBalance | null>(null);
    loading = input<boolean>(false);
    initialData = input<Partial<VacationRequestDraft> | null>(null);

    formSubmit = output<any>();

    schema = signal<DynamicFormSchema | null>(null);
    form: FormGroup = form({});
    pendingAttachments = signal<{ file: File, url: string }[]>([]);

    isHourly = computed(() => this.schema()?.unit === 'hours');

    dailyLimitExceeded = computed(() => {
        const s = this.schema();
        if (!s || !s.max_duration_per_day) return false;

        const requested = this.form.get('days_requested')?.value || 0;
        const start = this.form.get('start_date')?.value;
        const end = this.form.get('end_date')?.value;

        if (!start || !end) return false;

        // Very simplified business days check for UI feedback
        // In real app, we'd ideally call a service or use a shared util
        let workDays = 0;
        const d = new Date(start);
        const dEnd = new Date(end);
        while (d <= dEnd) {
            if (d.getDay() !== 0 && d.getDay() !== 6) workDays++;
            d.setDate(d.getDate() + 1);
        }

        const limit = workDays * s.max_duration_per_day;
        return requested > limit;
    });

    constructor() {
        effect(() => {
            const id = this.policyId();
            if (id) {
                this.loadSchema(id);
            }
        });

        effect(() => {
            const data = this.initialData();
            if (data && this.form) {
                const patch: any = {};
                if (data.start_date && this.form.contains('start_date')) patch.start_date = data.start_date;
                if (data.end_date && this.form.contains('end_date')) patch.end_date = data.end_date;
                if (data.days_requested !== undefined && this.form.contains('days_requested')) patch.days_requested = data.days_requested;
                
                if (Object.keys(patch).length > 0) {
                    this.form.patchValue(patch, { emitEvent: false });
                }
            }
        });
    }

    loadSchema(id: string) {
        this.policyService.getFormSchema(id).subscribe(schema => {
            this.schema.set(schema);
            this.buildForm(schema);
        });
    }

    buildForm(schema: DynamicFormSchema) {
        const groupDef: any = {
            policy_id: field(schema.policy_id, [Validators.required]),
            assigned_manager_id: field(this.managers().length === 1 ? this.managers()[0].id : '', [Validators.required]),
            days_requested: field(0, [Validators.required, Validators.min(0.1)])
        };

        const initData = this.initialData() || {};
        
        schema.fields.forEach(f => {
            if (f.type === 'file') return;
            if (f.name === 'days_requested') return; // Handled explicitly

            const validators = [];
            if (f.required) validators.push(Validators.required);
            if (f.min !== undefined) validators.push(Validators.min(f.min));
            if (f.max !== undefined) validators.push(Validators.max(f.max));

            let defaultValue = '';
            // Try to pick up initial start_date/end_date from calendar range selection
            if (f.name === 'start_date' && initData.start_date) defaultValue = initData.start_date;
            if (f.name === 'end_date' && initData.end_date) defaultValue = initData.end_date;
            
            groupDef[f.name] = field(defaultValue, validators);
        });

        this.form = form(groupDef);
        this.pendingAttachments.set([]);

        // Watch for date changes
        this.form.get('start_date')?.valueChanges.subscribe(() => this.calculateDays());
        this.form.get('end_date')?.valueChanges.subscribe(() => this.calculateDays());
    }

    calculateDays() {
        if (this.isHourly()) return; // Don't auto-calculate for hourly policies

        const start = this.form.get('start_date')?.value;
        const end = this.form.get('end_date')?.value;
        if (!start || !end) return;

        const dStart = new Date(start);
        const dEnd = new Date(end);
        if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime()) || dStart > dEnd) return;

        // Días naturales precisos (igual a la selección gráfica)
        const curStart = new Date(dStart);
        curStart.setHours(0, 0, 0, 0);
        const curEnd = new Date(dEnd);
        curEnd.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(curEnd.getTime() - curStart.getTime());
        const count = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        this.form.patchValue({ days_requested: count }, { emitEvent: false });
    }

    onFileSelected(event: any) {
        const files: FileList = event.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
            this.pendingAttachments.update(curr => [...curr, { file: files[i], url: '' }]);
        }
    }

    removePendingFile(index: number) {
        this.pendingAttachments.update(curr => curr.filter((_, i) => i !== index));
    }

    onSubmit() {
        if (this.form.invalid) return;
        const val = this.form.value;
        this.formSubmit.emit({
            request: val,
            files: this.pendingAttachments()
        });
    }
}
