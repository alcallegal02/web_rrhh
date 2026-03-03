import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { AuditLog } from '../../../../services/audit.service';

@Component({
    selector: 'app-audit-details',
    imports: [CommonModule, JsonPipe],
    templateUrl: './audit-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditDetailsComponent {
    log = input.required<AuditLog>();
    close = output<void>();

    formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString();
    }
}
