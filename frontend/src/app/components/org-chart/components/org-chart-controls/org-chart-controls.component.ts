import { Component, output, ChangeDetectionStrategy } from '@angular/core';


@Component({
    selector: 'app-org-chart-controls',
    imports: [],
    templateUrl: './org-chart-controls.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgChartControlsComponent {
    expandAll = output<void>();
    collapseAll = output<void>();
}
