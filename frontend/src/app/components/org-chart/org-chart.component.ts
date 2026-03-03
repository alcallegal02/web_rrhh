import { Component, inject, computed, ChangeDetectionStrategy, ViewChildren, QueryList } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { OrgChartService, OrgNode } from '../../services/org-chart.service';
import { OrgNodeComponent } from './components/org-node/org-node.component';
import { OrgChartControlsComponent } from './components/org-chart-controls/org-chart-controls.component';

@Component({
  selector: 'app-org-chart',
  imports: [CommonModule, OrgNodeComponent, OrgChartControlsComponent],
  templateUrl: './org-chart.component.html',
  styleUrl: './org-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgChartComponent {
  private orgChartService = inject(OrgChartService);
  treeResource = rxResource({
    stream: () => this.orgChartService.getOrgChart().pipe(
      map(data => {
        const process = (nodes: OrgNode[]) => {
          nodes.forEach(n => {
            n.expanded = false;
            if (n.children) process(n.children);
          });
        };
        // deep clone to avoid mutating the cached observable data if any
        const cloned = JSON.parse(JSON.stringify(data));
        process(cloned);
        return cloned as OrgNode[];
      })
    )
  });

  tree = computed(() => this.treeResource.value() || []);

  expandAll() {
    this.treeResource.update(current => current ? this.toggleNodes(current, true) : []);
  }

  collapseAll() {
    this.treeResource.update(current => current ? this.toggleNodes(current, false) : []);
  }

  private toggleNodes(nodes: OrgNode[], expanded: boolean): OrgNode[] {
    return nodes.map(node => ({
      ...node,
      expanded: expanded,
      children: node.children ? this.toggleNodes(node.children, expanded) : []
    }));
  }
}
