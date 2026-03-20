import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export type StatCardVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-stat-card',
  imports: [NgIconComponent],
  templateUrl: './stat-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  title = input.required<string>();
  value = input.required<string | number>();
  icon = input.required<string>();
  suffix = input<string>();
  description = input<string>();
  variant = input<StatCardVariant>('neutral');

  iconContainerClass = computed(() => {
    const variants: Record<StatCardVariant, string> = {
      primary: 'bg-inespasa text-white shadow-inespasa/30',
      success: 'bg-emerald-500 text-white shadow-emerald-500/30',
      warning: 'bg-amber-500 text-white shadow-amber-500/30',
      danger: 'bg-red-500 text-white shadow-red-500/30',
      info: 'bg-blue-500 text-white shadow-blue-500/30',
      neutral: 'bg-gray-100 text-gray-500 shadow-gray-200'
    };
    return variants[this.variant()];
  });

  bgGlowClass = computed(() => {
    const variants: Record<StatCardVariant, string> = {
      primary: 'bg-inespasa',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      danger: 'bg-red-500',
      info: 'bg-blue-500',
      neutral: 'bg-gray-200'
    };
    return variants[this.variant()];
  });
}

// Por qué esta estructura es más escalable:
// Encapsula el diseño premium corporativo (sombras, hover effects, layouts) para las tarjetas de KPIs.
// Evita duplicar decenas de clases de Tailwind en cada métrica del Dashboard o resúmenes.
