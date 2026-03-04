import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { form, field } from '../../../../utils/signal-forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PolicyService, PermissionPolicy, PermissionPolicyCreate, DurationUnit, Modality, PolicyResetType } from '../../../../services/policy.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { computed, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-policy-form',
    imports: [CommonModule, ReactiveFormsModule, RouterModule, NgIconComponent],
    templateUrl: './policy-form.component.html'
})
export class PolicyFormComponent {
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

    form = form({
        slug: field('', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]),
        name: field('', [Validators.required]),
        description: field(''),
        duration_value: field(0, [Validators.required, Validators.min(0)]),
        duration_unit: field('days_work' as DurationUnit, [Validators.required]),
        is_paid: field(true),
        requires_justification: field(false),
        modality: field('presencial_ausente' as Modality, [Validators.required]),
        limit_age_child: field<number | null>(null),

        // Advanced
        allow_split: field(false),
        mandatory_immediate_duration: field(0),
        split_min_duration: field(0),

        // Recurrence 2026
        reset_type: field('anual_calendario' as PolicyResetType, [Validators.required]),
        reset_month: field(1),
        reset_day: field(1),
        max_usos_por_periodo: field<number | null>(null),
        max_days_per_period: field(0),
        max_duration_per_day: field<number | null>(null),
        validity_window_value: field(0),
        validity_window_unit: field('months'),
        is_accumulable: field(false),
        accumulable_years: field(0),

        travel_extension_days: field(0),
        requires_document_type: field(''),

        color: field('#3B82F6'),
        icon: field(''),
        is_featured: field(false),
        is_public_dashboard: field(false)
    });

    constructor() {
        effect(() => {
            if (this.policyId()) {
                this.form.get('slug')?.disable();
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
        effect(() => {
            const name = this.form.get('name')?.value;
            if (!this.policyId() && name) {
                const slug = name.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '_');
                this.form.get('slug')?.setValue(slug);
            }
        }, { allowSignalWrites: true });
    }

    async onSubmit() {
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

        try {
            if (this.policyId()) {
                await firstValueFrom(this.policyService.updatePolicy(this.policyId()!, payload));
            } else {
                await firstValueFrom(this.policyService.createPolicy(payload));
            }
            this.router.navigate(['../'], { relativeTo: this.route });
        } catch (err: any) {
            alert('Error saving policy: ' + (err.message || err));
        }
    }
}
