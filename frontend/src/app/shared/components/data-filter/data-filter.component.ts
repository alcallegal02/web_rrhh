import { Component, input, output, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterField, FilterValue } from '../../utils/filter.utils';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideFilter, lucideX, lucideChevronDown, lucideSearch, lucideCalendar } from '@ng-icons/lucide';

@Component({
  selector: 'app-data-filter',
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideFilter, lucideX, lucideChevronDown, lucideSearch, lucideCalendar })],
  templateUrl: './data-filter.component.html',
  styleUrl: './data-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataFilterComponent {
  fields = input.required<FilterField[]>();
  filterChange = output<FilterValue>();

  currentFilters = signal<FilterValue>({});

  hasActiveFilters = computed(() => {
    return Object.values(this.currentFilters()).some(v => v !== undefined && v !== '' && v !== null);
  });

  toggleValue(key: string, value: any) {
    const current = this.currentFilters();
    if (current[key] === value) {
      const { [key]: _, ...rest } = current;
      this.currentFilters.set(rest);
    } else {
      this.currentFilters.set({ ...current, [key]: value });
    }
    this.emitChange();
  }

  isToggleSelected(key: string, value: any): boolean {
    return this.currentFilters()[key] === value;
  }

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
