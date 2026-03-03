import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PolicyService, PermissionPolicy } from '../../../services/policy.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { computed } from '@angular/core';

@Component({
    selector: 'app-policy-config',
    imports: [CommonModule, RouterModule],
    templateUrl: './policy-config.component.html'
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
