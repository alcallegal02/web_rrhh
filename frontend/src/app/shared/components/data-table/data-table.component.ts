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
  template: `
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
      <div class="overflow-x-auto custom-scrollbar">
        <table class="min-w-full divide-y divide-gray-100">
          <thead class="bg-gray-50/50">
            <tr>
              @for (col of columns(); track col.key) {
                <th [class]="'text-' + (col.align || 'left')"
                  class="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  {{ col.label }}
                </th>
              }
              @if (hasActions()) {
                <th class="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Acciones</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            @for (row of data(); track row.id || $index) {
              <tr class="hover:bg-gray-50/20 transition-all group">
                @for (col of columns(); track col.key) {
                  <td class="px-8 py-5" [class]="'text-' + (col.align || 'left')">
                    @switch (col.type) {
                      @case ('date') {
                        <span class="text-[13px] font-bold text-gray-600">{{ row[col.key] | date:'dd MMM yyyy' }}</span>
                      }
                      @case ('badge') {
                        @if (col.badgeMap) {
                          @let b = col.badgeMap(row[col.key]);
                          <span [class]="getBadgeClass(b.variant)" 
                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border">
                            @if (b.icon) { <ng-icon [name]="b.icon"></ng-icon> }
                            {{ b.label }}
                          </span>
                        }
                      }
                      @case ('custom') {
                        <ng-container *ngTemplateOutlet="customTemplate; context: { $implicit: row, col: col }"></ng-container>
                      }
                      @default {
                        <span class="text-[14px] font-black text-gray-900">{{ row[col.key] }}</span>
                      }
                    }
                  </td>
                }
                @if (hasActions()) {
                  <td class="px-8 py-5 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <ng-container *ngTemplateOutlet="actionsTemplate; context: { $implicit: row }"></ng-container>
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
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
