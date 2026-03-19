import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { form, field } from '../../../../shared/utils/signal-forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PolicyService, PermissionPolicy, PermissionPolicyCreate, DurationUnit, Modality, PolicyResetType } from '../../../../services/policy.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideArrowLeft, lucideSave, lucideInfo, lucideCalendar,
    lucideClock, lucideSettings, lucideUser, lucideBaby,
    lucideSplit, lucideInfinity, lucideHistory, lucideDatabase,
    lucideCheck, lucideTrash2, lucidePalette, lucideTextQuote,
    lucideLayoutDashboard, lucideScale, lucideZap, lucideShield,
    lucideTags, lucideFileText, lucideStar, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-policy-form',
    imports: [ReactiveFormsModule, RouterModule, NgIconComponent],
    templateUrl: './policy-form.component.html',
    providers: [
        provideIcons({
            lucideArrowLeft, lucideSave, lucideInfo, lucideCalendar,
            lucideClock, lucideSettings, lucideUser, lucideBaby,
            lucideSplit, lucideInfinity, lucideHistory, lucideDatabase,
            lucideCheck, lucideTrash2, lucidePalette, lucideTextQuote,
            lucideLayoutDashboard, lucideScale, lucideZap, lucideShield,
            lucideTags, lucideFileText, lucideStar, lucideHelpCircle
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolicyFormComponent {
    private readonly policyService = inject(PolicyService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    private readonly paramMap = toSignal(this.route.paramMap);
    readonly policyId = computed(() => {
        const id = this.paramMap()?.get('id');
        return (id && id !== 'new') ? id : null;
    });

    readonly isSystemDefault = signal(false);

    readonly policiesResource = rxResource<PermissionPolicy[], unknown>({
        stream: () => this.policyService.getPolicies()
    });

    readonly form = form({
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
        // Deshabilitar slug si estamos editando
        effect(() => {
            const id = this.policyId();
            if (id) {
                this.form.get('slug')?.disable();
            }
        });

        // Cargar datos de la política al formulario
        effect(() => {
            const id = this.policyId();
            const policies = this.policiesResource.value();
            if (id && policies) {
                const policy = (policies as PermissionPolicy[]).find(p => p.id === id);
                if (policy) {
                    this.form.patchValue(policy);
                    this.isSystemDefault.set(policy.is_system_default);
                }
            }
        });

        // Auto-generación de slug basada en el nombre (solo para nuevas)
        effect(() => {
            const name = this.form.get('name')?.value;
            if (!this.policyId() && name) {
                const slug = name.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, '_');
                this.form.get('slug')?.setValue(slug, { emitEvent: false });
            }
        });
    }

    async onSubmit() {
        if (this.form.invalid) return;

        const val = this.form.getRawValue();
        const payload: PermissionPolicyCreate = {
            ...val,
            description: val.description || undefined,
            limit_age_child: val.limit_age_child || undefined,
            max_usos_por_periodo: val.max_usos_por_periodo || undefined,
            max_duration_per_day: val.max_duration_per_day || undefined,
            requires_document_type: val.requires_document_type || undefined,
            color: val.color || undefined,
            icon: val.icon || undefined
        } as PermissionPolicyCreate;

        try {
            if (this.policyId()) {
                await firstValueFrom(this.policyService.updatePolicy(this.policyId()!, payload));
            } else {
                await firstValueFrom(this.policyService.createPolicy(payload));
            }
            this.router.navigate(['../'], { relativeTo: this.route });
        } catch (err: any) {
            alert('Error saving policy: ' + (err.error?.detail || err.message || err));
        }
    }
}
