import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export interface PageAction {
  label: string;
  icon: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  id: string;
}

@Component({
  selector: 'app-page-header',
  imports: [NgIconComponent],
  template: `
    <div class="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 animate-fadeIn">
      <div class="space-y-1">
        <div class="flex items-center gap-4">
          @if (icon()) {
            <div class="flex items-center justify-center w-14 h-14 rounded-2xl bg-inespasa shadow-lg shadow-inespasa-light/20 text-white">
              <ng-icon [name]="icon()!" class="text-3xl"></ng-icon>
            </div>
          }
          <div>
            <h1 class="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">{{ title() }}</h1>
            @if (subtitle()) {
              <p class="text-gray-500 mt-2 text-sm md:text-base font-medium flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-inespasa animate-pulse"></span>
                {{ subtitle() }}
              </p>
            }
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        @for (action of actions(); track action.id) {
          <button (click)="actionClick.emit(action.id)"
            [class]="getBtnClass(action.variant)"
            class="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm">
            <ng-icon [name]="action.icon" class="text-base"></ng-icon>
            {{ action.label }}
          </button>
        }
        <ng-content select="[extra-actions]"></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppPageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>();
  icon = input<string>();
  actions = input<PageAction[]>([]);
  
  actionClick = output<string>();

  getBtnClass(variant: string = 'primary'): string {
    const base = 'border-2 ';
    const classes: Record<string, string> = {
      primary: 'bg-inespasa border-inespasa text-white hover:bg-inespasa-dark hover:border-inespasa-dark shadow-inespasa-light/30',
      secondary: 'bg-white border-gray-100 text-gray-600 hover:border-inespasa-light/30 hover:text-inespasa',
      danger: 'bg-red-50 border-red-50 text-red-600 hover:bg-red-100',
      ghost: 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
    };
    return base + (classes[variant] || classes['primary']);
  }
}
