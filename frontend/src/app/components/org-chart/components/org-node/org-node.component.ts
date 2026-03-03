import { Component, input, linkedSignal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgNode } from '../../../../services/org-chart.service';

@Component({
    selector: 'app-org-node',
    imports: [CommonModule, OrgNodeComponent],
    templateUrl: './org-node.component.html',
    styleUrl: './org-node.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgNodeComponent {
    node = input.required<OrgNode>();

    // Use linkedSignal for mutable state that depends on an input
    isExpanded = linkedSignal(() => !!this.node().expanded);

    toggleExpand(event?: Event) {
        if (event) event.stopPropagation();
        const n = this.node();
        if (n.children && n.children.length > 0) {
            this.isExpanded.set(!this.isExpanded());

            // Sync with underlying object just in case it's read by a parent
            n.expanded = this.isExpanded();
        }
    }
}
