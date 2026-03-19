import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export type StatCardVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-stat-card',
  imports: [NgIconComponent],
  template: `
    <div class="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
      <!-- Decorative Background Shape -->
      <div class="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"
           [class]="bgGlowClass()">
      </div>

      <div class="relative z-10 flex items-start gap-5">
        <!-- Icon Container -->
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center flex-none shadow-md transition-transform group-hover:scale-110"
             [class]="iconContainerClass()">
          <ng-icon [name]="icon()" class="text-2xl"></ng-icon>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <h3 class="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1 truncate">{{ title() }}</h3>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{{ value() }}</span>
            @if (suffix()) {
              <span class="text-sm font-bold text-gray-500">{{ suffix() }}</span>
            }
          </div>
          
          @if (description()) {
            <p class="text-xs font-medium text-gray-500 mt-2 line-clamp-2">{{ description() }}</p>
          }
        </div>
      </div>
      
      <!-- Optional Action / Footer Area -->
      <div class="mt-6">
          <ng-content></ng-content>
      </div>
    </div>
  `,
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
