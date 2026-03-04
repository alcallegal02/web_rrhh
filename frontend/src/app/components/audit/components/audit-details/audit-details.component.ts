import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { AuditLog } from '../../../../services/audit.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideClipboardList, lucideX, lucideBox,
    lucideZap, lucideCalendar, lucideUser
} from '@ng-icons/lucide';

@Component({
    selector: 'app-audit-details',
    imports: [CommonModule, NgIconComponent],
    templateUrl: './audit-details.component.html',
    providers: [
        provideIcons({
            lucideClipboardList, lucideX, lucideBox,
            lucideZap, lucideCalendar, lucideUser
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditDetailsComponent {
    log = input.required<AuditLog>();
    close = output<void>();

    get hasChanges(): boolean {
        return !!(this.log().details && (this.log().details as any).changes);
    }

    get changes(): any {
        return (this.log().details as any).changes || {};
    }

    get hasSnapshot(): boolean {
        return !!(this.log().details && (this.log().details as any).full_snapshot);
    }

    get snapshot(): any {
        return (this.log().details as any).full_snapshot || {};
    }

    objectKeys(obj: any): string[] {
        return Object.keys(obj);
    }

    formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString();
    }
}
