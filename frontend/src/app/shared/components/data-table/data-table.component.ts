import { Component, input, output, ChangeDetectionStrategy, ContentChild, TemplateRef } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';

export interface ColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'badge' | 'custom' | 'currency';
  align?: 'left' | 'center' | 'right';
  badgeMap?: (val: any) => { variant: string, icon?: string, label: string };
}

@Component({
  selector: 'app-data-table',
  imports: [DatePipe, NgTemplateOutlet, NgIconComponent],
  templateUrl: './data-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppDataTableComponent {
  columns = input.required<ColumnDef[]>();
  data = input.required<any[]>();
  hasActions = input<boolean>(false);

  @ContentChild('customCell') customTemplate!: TemplateRef<any>;
  @ContentChild('rowActions') actionsTemplate!: TemplateRef<any>;

  getBadgeClass(variant: string): string {
    const variants: Record<string, string> = {
      success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      error: 'bg-red-50 text-red-700 border-red-200',
      info: 'bg-blue-50 text-blue-700 border-blue-200',
      neutral: 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return variants[variant] || variants['neutral'];
  }
}
