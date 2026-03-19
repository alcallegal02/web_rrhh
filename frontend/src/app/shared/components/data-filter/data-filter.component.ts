import { Component, input, output, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterField, FilterValue } from '../../utils/filter.utils';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideFilter, lucideX, lucideChevronDown, lucideSearch, lucideCalendar } from '@ng-icons/lucide';

@Component({
  selector: 'app-data-filter',
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideFilter, lucideX, lucideChevronDown, lucideSearch, lucideCalendar })],
  template: `
    <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 mb-8 animate-fadeIn">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <ng-icon name="lucideFilter" class="text-xl"></ng-icon>
        </div>
        <div>
          <h3 class="text-sm font-black text-gray-800 uppercase tracking-widest">Filtros de Búsqueda</h3>
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Refina los resultados según tus criterios</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        @for (field of fields(); track field.key) {
          <div class="space-y-2">
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{{ field.label }}</label>
            
            @switch (field.type) {
              @case ('text') {
                <div class="relative group">
                  <ng-icon name="lucideSearch" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"></ng-icon>
                  <input type="text" 
                    [placeholder]="field.placeholder || 'Buscar...'"
                    [(ngModel)]="currentFilters()[field.key]"
                    (ngModelChange)="emitChange()"
                    class="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm">
                </div>
              }
              
              @case ('select') {
                <select [(ngModel)]="currentFilters()[field.key]" 
                  (ngModelChange)="emitChange()"
                  class="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm cursor-pointer appearance-none bg-no-repeat bg-[right_1rem_center]"
                  style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E');">
                  <option [value]="undefined">Todos</option>
                  @for (opt of field.options; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              }

              @case ('date') {
                <div class="relative group">
                  <ng-icon name="lucideCalendar" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"></ng-icon>
                  <input type="date" 
                    [(ngModel)]="currentFilters()[field.key]"
                    (ngModelChange)="emitChange()"
                    class="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-blue-100 outline-none transition-all shadow-sm">
                </div>
              }
            }
          </div>
        }
      </div>

      @if (hasActiveFilters()) {
        <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button (click)="clearAll()" 
            class="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
            <ng-icon name="lucideX" class="text-sm"></ng-icon>
            Limpiar Filtros
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataFilterComponent {
  fields = input.required<FilterField[]>();
  filterChange = output<FilterValue>();

  currentFilters = signal<FilterValue>({});

  hasActiveFilters = computed(() => {
    return Object.values(this.currentFilters()).some(v => v !== undefined && v !== '' && v !== null);
  });

  emitChange() {
    this.filterChange.emit(this.currentFilters());
  }

  clearAll() {
    this.currentFilters.set({});
    this.emitChange();
  }
}

// Por qué esta estructura es más escalable:
// Separa la UI de los filtros de la lógica de cada página. Para añadir filtros en una nueva página
// solo necesitas definir un array de configuración (Schema), sin escribir una sola línea de HTML o CSS para los inputs.
