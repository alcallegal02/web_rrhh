import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { AuditService, AuditLog } from '../../services/audit.service';
import { catchError, of, switchMap } from 'rxjs';

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
    filterModule = signal<string[]>([]);
    filterAction = signal<string[]>([]);
    filterStartDate = signal<string | undefined>(undefined);
    filterEndDate = signal<string | undefined>(undefined);

    // Pagination
    currentPage = signal<number>(0);
    pageSize = 50;

    // Resource for data fetching
    logsResource = rxResource({
        stream: () => {
            const page = this.currentPage();
            const module = this.filterModule();
            const action = this.filterAction();
            const start_date = this.filterStartDate();
            const end_date = this.filterEndDate();

            const filters = {
                module: module.length > 0 ? module : undefined,
                action: action.length > 0 ? action : undefined,
                start_date,
                end_date
            };

            return of(0).pipe(
                switchMap(() => this.auditService.getLogs(page, this.pageSize, filters)),
                catchError(() => of([]))
            );
        }
    });

    // Computed state
    logs = computed(() => this.logsResource.value() || []);
    loading = computed(() => this.logsResource.isLoading());

    // Selection
    selectedLog = signal<AuditLog | null>(null);

    onFiltersChanged(filters: {
        module: string[],
        action: string[],
        start_date?: string,
        end_date?: string
    }) {
        this.filterModule.set(filters.module);
        this.filterAction.set(filters.action);
        this.filterStartDate.set(filters.start_date);
        this.filterEndDate.set(filters.end_date);
        this.currentPage.set(0);
        this.logsResource.reload();
    }

    onPageChange(page: number) {
        this.currentPage.set(page);
        this.logsResource.reload();
    }

    onItemSelected(log: AuditLog) {
        this.selectedLog.set(log);
    }
}
