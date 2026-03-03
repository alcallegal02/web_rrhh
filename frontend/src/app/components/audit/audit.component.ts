import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { AuditService, AuditLog } from '../../services/audit.service';
import { catchError, of } from 'rxjs';

import { AuditFiltersComponent } from './components/audit-filters/audit-filters.component';
import { AuditListComponent } from './components/audit-list/audit-list.component';
import { AuditDetailsComponent } from './components/audit-details/audit-details.component';

@Component({
    selector: 'app-audit',
    imports: [CommonModule, AuditFiltersComponent, AuditListComponent, AuditDetailsComponent],
    templateUrl: './audit.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditComponent {
    private auditService = inject(AuditService);

    // State
    // Filters
    filterModule = signal<string>('');
    filterAction = signal<string>('');

    // Pagination
    currentPage = signal<number>(0);
    pageSize = 50;

    // Resource for data fetching
    logsResource = rxResource({
        stream: () => {
            const page = this.currentPage();
            const size = this.pageSize;
            const module = this.filterModule() || undefined;
            const action = this.filterAction() || undefined;
            return this.auditService.getLogs(page, size, { module, action })
                .pipe(catchError(() => of([])));
        }
    });

    // Computed state
    logs = computed(() => this.logsResource.value() || []);
    loading = computed(() => this.logsResource.isLoading());

    // Selection
    selectedLog = signal<AuditLog | null>(null);

    onFiltersChanged(filters: { module: string, action: string }) {
        this.filterModule.set(filters.module);
        this.filterAction.set(filters.action);
        this.currentPage.set(0);
    }

    onPageChange(page: number) {
        this.currentPage.set(page);
    }

    onItemSelected(log: AuditLog) {
        this.selectedLog.set(log);
    }
}
