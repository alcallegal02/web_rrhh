import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-audit-filters',
    imports: [CommonModule, FormsModule],
    templateUrl: './audit-filters.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditFiltersComponent {
    filtersChanged = output<{ module: string, action: string }>();

    filterModule = signal('');
    filterAction = signal('');

    applyFilters() {
        this.filtersChanged.emit({
            module: this.filterModule(),
            action: this.filterAction()
        });
    }

    clearFilters() {
        this.filterModule.set('');
        this.filterAction.set('');
        this.applyFilters();
    }
}
