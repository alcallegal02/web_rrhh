import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'indigo' | 'purple';

@Component({
  selector: 'app-status-badge',
  imports: [NgIconComponent],
  template: `
    <span [class]="containerClass()" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all">
      @if (icon()) {
        <ng-icon [name]="icon()!" [class]="iconClass()"></ng-icon>
      }
      <ng-content></ng-content>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  variant = input<BadgeVariant>('neutral');
  icon = input<string | null>(null);
  pulse = input<boolean>(false);

  containerClass = computed(() => {
    const base = this.pulse() ? 'animate-pulse ' : '';
    const variants: Record<BadgeVariant, string> = {
      success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      error: 'bg-red-50 text-red-700 border-red-200',
      info: 'bg-blue-50 text-blue-700 border-blue-200',
      indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      neutral: 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return base + variants[this.variant()];
  });

  iconClass = computed(() => {
    const variants: Record<BadgeVariant, string> = {
      success: 'text-emerald-500',
      warning: 'text-amber-500',
      error: 'text-red-500',
      info: 'text-blue-500',
      indigo: 'text-indigo-500',
      purple: 'text-purple-500',
      neutral: 'text-gray-400'
    };
    return variants[this.variant()];
  });
}

// Por qué esta estructura es más escalable:
// Centraliza los estilos de badges de toda la app, permitiendo cambios globales de diseño 
// (ej: cambiar de diseño sólido a flat) desde un solo lugar.
