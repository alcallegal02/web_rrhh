import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
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
    @Input({ required: true }) node!: OrgNode;

    toggleExpand(event?: Event) {
        if (event) event.stopPropagation();
        if (this.node.children && this.node.children.length > 0) {
            this.node.expanded = !this.node.expanded;
        }
    }
}
