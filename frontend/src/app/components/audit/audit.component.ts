import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    logs = signal<AuditLog[]>([]);
    loading = signal<boolean>(false);
    currentPage = signal<number>(0);
    pageSize = 50;

    // Filters
    filterModule = signal<string>('');
    filterAction = signal<string>('');

    // Selection
    selectedLog = signal<AuditLog | null>(null);

    constructor() {
        this.loadLogs();
    }

    loadLogs() {
        this.loading.set(true);
        const filters = {
            module: this.filterModule() || undefined,
            action: this.filterAction() || undefined
        };

        this.auditService.getLogs(this.currentPage(), this.pageSize, filters)
            .pipe(catchError(() => {
                this.loading.set(false);
                return of([]);
            }))
            .subscribe(data => {
                this.logs.set(data);
                this.loading.set(false);
            });
    }

    onFiltersChanged(filters: { module: string, action: string }) {
        this.filterModule.set(filters.module);
        this.filterAction.set(filters.action);
        this.currentPage.set(0);
        this.loadLogs();
    }

    onPageChange(page: number) {
        this.currentPage.set(page);
        this.loadLogs();
    }

    onItemSelected(log: AuditLog) {
        this.selectedLog.set(log);
    }
}
