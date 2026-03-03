import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PolicyService, PermissionPolicy, PermissionPolicyCreate, DurationUnit, Modality, PolicyResetType } from '../../../../services/policy.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { computed, effect } from '@angular/core';

@Component({
    selector: 'app-policy-form',
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './policy-form.component.html'
})
export class PolicyFormComponent {
    private fb = inject(FormBuilder);
    private policyService = inject(PolicyService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    private paramMap = toSignal(this.route.paramMap);
    policyId = computed(() => {
        const id = this.paramMap()?.get('id');
        return (id && id !== 'new') ? id : null;
    });

    isSystemDefault = signal(false);

    policiesResource = rxResource({
        stream: () => this.policyService.getPolicies()
    });

    form = this.fb.group({
        slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]],
        name: ['', Validators.required],
        description: [''],
        duration_value: [0, [Validators.required, Validators.min(0)]],
        duration_unit: ['days_work' as DurationUnit, Validators.required],
        is_paid: [true],
        requires_justification: [false],
        modality: ['presencial_ausente' as Modality, Validators.required],
        limit_age_child: [null as number | null],

        // Advanced
        allow_split: [false],
        mandatory_immediate_duration: [0],
        split_min_duration: [0],

        // Recurrence 2026
        reset_type: ['anual_calendario' as PolicyResetType, Validators.required],
        reset_month: [1],
        reset_day: [1],
        max_usos_por_periodo: [null as number | null],
        max_days_per_period: [0],
        max_duration_per_day: [null as number | null],
        validity_window_value: [0],
        validity_window_unit: ['months'],
        is_accumulable: [false],
        accumulable_years: [0],

        travel_extension_days: [0],
        requires_document_type: [''],

        color: ['#3B82F6'],
        icon: [''],
        is_featured: [false],
        is_public_dashboard: [false]
    });

    constructor() {
        effect(() => {
            if (this.policyId()) {
                this.form.controls.slug.disable();
            }
        });

        effect(() => {
            const id = this.policyId();
            const policies = this.policiesResource.value();
            if (id && policies) {
                const policy = policies.find(p => p.id === id);
                if (policy) {
                    this.form.patchValue(policy);
                    this.isSystemDefault.set(policy.is_system_default);
                }
            }
        });

        // Auto-generate slug from name if creating new
        this.form.controls.name.valueChanges.subscribe((name: string | null) => {
            if (!this.policyId() && name) {
                const slug = name.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '_');
                this.form.controls.slug.setValue(slug, { emitEvent: false });
            }
        });
    }

    onSubmit() {
        if (this.form.invalid) return;

        const val = this.form.getRawValue();
        const payload: PermissionPolicyCreate = {
            name: val.name!,
            slug: val.slug!,
            description: val.description || undefined,
            duration_value: val.duration_value!,
            duration_unit: val.duration_unit as DurationUnit,
            is_paid: val.is_paid!,
            requires_justification: val.requires_justification!,
            modality: val.modality as Modality,
            limit_age_child: val.limit_age_child || undefined,

            allow_split: val.allow_split || false,
            mandatory_immediate_duration: val.mandatory_immediate_duration || 0,
            split_min_duration: val.split_min_duration || 0,

            reset_type: val.reset_type as PolicyResetType,
            reset_month: val.reset_month || 1,
            reset_day: val.reset_day || 1,
            max_usos_por_periodo: val.max_usos_por_periodo || undefined,
            max_days_per_period: val.max_days_per_period || 0,
            max_duration_per_day: val.max_duration_per_day || undefined,
            validity_window_value: val.validity_window_value || 0,
            validity_window_unit: val.validity_window_unit || 'months',
            is_accumulable: val.is_accumulable || false,
            accumulable_years: val.accumulable_years || 0,

            travel_extension_days: val.travel_extension_days || 0,
            requires_document_type: val.requires_document_type || undefined,

            color: val.color || undefined,
            icon: val.icon || undefined,
            is_featured: val.is_featured || false,
            is_public_dashboard: val.is_public_dashboard || false
        };

        if (this.policyId()) {
            this.policyService.updatePolicy(this.policyId()!, payload).subscribe({
                next: () => this.router.navigate(['../'], { relativeTo: this.route }),
                error: (err: any) => alert('Error updating policy: ' + (err.message || err))
            });
        } else {
            this.policyService.createPolicy(payload).subscribe({
                next: () => this.router.navigate(['../'], { relativeTo: this.route }),
                error: (err: any) => alert('Error creating policy: ' + (err.message || err))
            });
        }
    }
}
