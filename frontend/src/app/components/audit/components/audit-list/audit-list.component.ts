import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLog } from '../../../../services/audit.service';

@Component({
    selector: 'app-audit-list',
    imports: [CommonModule],
    templateUrl: './audit-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditListComponent {
    logs = input.required<AuditLog[]>();
    loading = input<boolean>(false);
    currentPage = input.required<number>();
    pageSize = input.required<number>();

    itemSelected = output<AuditLog>();
    pageChange = output<number>();

    formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString();
    }

    nextPage() {
        this.pageChange.emit(this.currentPage() + 1);
    }

    prevPage() {
        if (this.currentPage() > 0) {
            this.pageChange.emit(this.currentPage() - 1);
        }
    }
}
