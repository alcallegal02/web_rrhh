import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { AuditService, AuditLog } from '../../services/audit.service';
import { catchError, of, switchMap } from 'rxjs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck } from '@ng-icons/lucide';

import { AuditFiltersComponent } from './components/audit-filters/audit-filters.component';
import { AuditListComponent } from './components/audit-list/audit-list.component';
import { AuditDetailsComponent } from './components/audit-details/audit-details.component';

import { AppPageHeaderComponent, PageAction } from '../../shared/components/page-header/page-header.component';
import { AppDataTableComponent, ColumnDef } from '../../shared/components/data-table/data-table.component';

@Component({
    selector: 'app-audit',
    imports: [AuditFiltersComponent, AuditDetailsComponent, NgIconComponent, AppPageHeaderComponent, AppDataTableComponent],
    templateUrl: './audit.component.html',
    providers: [
        provideIcons({ lucideShieldCheck })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditComponent {
    private readonly auditService = inject(AuditService);

    // Configuración de Cabecera
    readonly pageActions: PageAction[] = [
      { id: 'refresh', label: 'Refrescar', icon: 'lucideShieldCheck', variant: 'secondary' }
    ];

    // Configuración de Tabla
    readonly tableColumns: ColumnDef[] = [
      { key: 'created_at', label: 'Fecha y Hora', type: 'date' },
      { key: 'module', label: 'Módulo', type: 'text' },
      { key: 'action', label: 'Acción', type: 'text' },
      { key: 'ip_address', label: 'IP Origen', type: 'text' }
    ];

    // Filters as signals
    readonly filterModule = signal<string[]>([]);
    readonly filterAction = signal<string[]>([]);
    readonly filterStartDate = signal<string | undefined>(undefined);
    readonly filterEndDate = signal<string | undefined>(undefined);

    // Pagination
    readonly currentPage = signal<number>(0);
    readonly pageSize = 50;

    // Resource for data fetching - reactivo a los cambios de filtros y página
    readonly logsResource = rxResource<AuditLog[], {
        page: number,
        module: string[],
        action: string[],
        start_date?: string,
        end_date?: string
    }>({
        params: () => ({
            page: this.currentPage(),
            module: this.filterModule(),
            action: this.filterAction(),
            start_date: this.filterStartDate(),
            end_date: this.filterEndDate()
        }),
        stream: ({ params }) => {
            const filters = {
                module: params.module.length > 0 ? params.module : undefined,
                action: params.action.length > 0 ? params.action : undefined,
                start_date: params.start_date,
                end_date: params.end_date
            };
            return this.auditService.getLogs(params.page, this.pageSize, filters).pipe(
                catchError(() => of([]))
            );
        }
    });

    // Computed state
    readonly logs = computed(() => this.logsResource.value() ?? []);
    readonly loading = computed(() => this.logsResource.isLoading());

    // Selection
    readonly selectedLog = signal<AuditLog | null>(null);

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
        // rxResource se recargará automáticamente al cambiar los signals en request()
    }

    onPageChange(page: number) {
        this.currentPage.set(page);
    }

    onItemSelected(log: AuditLog) {
        this.selectedLog.set(log);
    }
}
