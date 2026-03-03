import { Component, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-org-chart-controls',
    imports: [CommonModule],
    templateUrl: './org-chart-controls.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgChartControlsComponent {
    expandAll = output<void>();
    collapseAll = output<void>();
}
