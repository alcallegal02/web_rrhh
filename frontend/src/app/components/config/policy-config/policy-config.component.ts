import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PolicyService, PermissionPolicy } from '../../../services/policy.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideShield, lucidePlus, lucideEdit3, lucideTrash2, lucideStar,
    lucidePower, lucideCheckCircle, lucideXCircle, lucideClock,
    lucideCalendar, lucideFileText, lucideTags, lucideArrowLeft,
    lucideChevronRight, lucidePlusCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-policy-config',
    imports: [CommonModule, RouterModule, NgIconComponent],
    templateUrl: './policy-config.component.html',
    providers: [
        provideIcons({
            lucideShield, lucidePlus, lucideEdit3, lucideTrash2, lucideStar,
            lucidePower, lucideCheckCircle, lucideXCircle, lucideClock,
            lucideCalendar, lucideFileText, lucideTags, lucideArrowLeft,
            lucideChevronRight, lucidePlusCircle
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PolicyConfigComponent {
    private policyService = inject(PolicyService);

    policiesResource = rxResource({
        stream: () => this.policyService.getPolicies()
    });

    policies = computed(() => this.policiesResource.value() || []);
    isLoading = computed(() => this.policiesResource.isLoading());

    toggleActive(policy: PermissionPolicy) {
        this.policyService.updatePolicy(policy.id, { is_active: !policy.is_active }).subscribe(() => {
            this.policiesResource.reload();
        });
    }

    toggleFeatured(policy: PermissionPolicy) {
        this.policyService.updatePolicy(policy.id, { is_featured: !policy.is_featured }).subscribe(() => {
            this.policiesResource.reload();
        });
    }
}
