import { Component, inject, computed, ChangeDetectionStrategy, ViewChildren, QueryList } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { OrgChartService, OrgNode } from '../../services/org-chart.service';
import { OrgNodeComponent } from './components/org-node/org-node.component';
import { OrgChartControlsComponent } from './components/org-chart-controls/org-chart-controls.component';

@Component({
  selector: 'app-org-chart',
  imports: [OrgNodeComponent, OrgChartControlsComponent],
  templateUrl: './org-chart.component.html',
  styleUrl: './org-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgChartComponent {
  private readonly orgChartService = inject(OrgChartService);

  readonly treeResource = rxResource<OrgNode[], unknown>({
    stream: () => this.orgChartService.getOrgChart().pipe(
      map(data => {
        const process = (nodes: OrgNode[]) => {
          nodes.forEach(n => {
            n.expanded = false;
            if (n.children) process(n.children);
          });
        };
        const cloned = structuredClone(data);
        process(cloned);
        return cloned as OrgNode[];
      })
    )
  });

  readonly tree = computed(() => this.treeResource.value() ?? []);

  expandAll() {
    this.treeResource.update(current => Array.isArray(current) ? this.toggleNodes(current, true) : []);
  }

  collapseAll() {
    this.treeResource.update(current => Array.isArray(current) ? this.toggleNodes(current, false) : []);
  }

  private toggleNodes(nodes: OrgNode[], expanded: boolean): OrgNode[] {
    return nodes.map(node => ({
      ...node,
      expanded: expanded,
      children: node.children ? this.toggleNodes(node.children, expanded) : []
    }));
  }
}
