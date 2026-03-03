import { Component, input, output, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PolicyService } from '../../../../services/policy.service';
import { ResponsibleUser, VacationService, VacationBalance } from '../../../../services/vacation.service';
import { VacationRequestDraft } from '../vacation-request-form/vacation-request-form.component';

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
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './vacation-dynamic-form.component.html',
})
export class VacationDynamicFormComponent {
    private fb = inject(FormBuilder);
    private policyService = inject(PolicyService);

    policyId = input<string>('');
    managers = input<ResponsibleUser[]>([]);
    balance = input<VacationBalance | null>(null);
    loading = input<boolean>(false);

    formSubmit = output<any>();

    schema = signal<DynamicFormSchema | null>(null);
    form: FormGroup = this.fb.group({});
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
    }

    loadSchema(id: string) {
        this.policyService.getFormSchema(id).subscribe(schema => {
            this.schema.set(schema);
            this.buildForm(schema);
        });
    }

    buildForm(schema: DynamicFormSchema) {
        const group: any = {
            policy_id: [schema.policy_id, Validators.required],
            assigned_manager_id: [this.managers().length === 1 ? this.managers()[0].id : '', Validators.required],
            days_requested: [0, [Validators.required, Validators.min(0.1)]]
        };

        schema.fields.forEach(field => {
            if (field.type === 'file') return;
            if (field.name === 'days_requested') return; // Handled explicitly

            const validators = [];
            if (field.required) validators.push(Validators.required);
            if (field.min !== undefined) validators.push(Validators.min(field.min));
            if (field.max !== undefined) validators.push(Validators.max(field.max));

            group[field.name] = ['', validators];
        });

        this.form = this.fb.group(group);
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

        // Simple calculation (can be refined to match backend business days logic)
        let count = 0;
        const cur = new Date(dStart);
        cur.setHours(0, 0, 0, 0);
        const curEnd = new Date(dEnd);
        curEnd.setHours(0, 0, 0, 0);

        while (cur <= curEnd) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++; // Simple skip weekends
            cur.setDate(cur.getDate() + 1);
        }

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
