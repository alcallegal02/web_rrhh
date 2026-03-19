import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { AuditLog } from '../../../../services/audit.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideShield, lucideUsers, lucideNewspaper, lucideAlertTriangle,
    lucideCalendar, lucideFileText, lucideTags, lucideClipboardList,
    lucideSun, lucideActivity, lucidePlusCircle, lucideEdit3,
    lucideTrash2, lucideLogIn, lucideKey, lucideSettings,
    lucideChevronRight, lucideInbox, lucideChevronLeft, lucideHistory, lucideDatabase
} from '@ng-icons/lucide';

@Component({
    selector: 'app-audit-list',
    imports: [NgIconComponent],
    templateUrl: './audit-list.component.html',
    providers: [
        provideIcons({
            lucideShield, lucideUsers, lucideNewspaper, lucideAlertTriangle,
            lucideCalendar, lucideFileText, lucideTags, lucideClipboardList,
            lucideSun, lucideActivity, lucidePlusCircle, lucideEdit3,
            lucideTrash2, lucideLogIn, lucideKey, lucideSettings,
            lucideChevronRight, lucideInbox, lucideChevronLeft, lucideHistory, lucideDatabase
        })
    ],
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
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    getActionClass(action: string): string {
        if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (action.includes('UPDATE')) return 'bg-amber-50 text-amber-700 border-amber-100';
        if (action.includes('DELETE')) return 'bg-red-50 text-red-700 border-red-100';
        if (action.includes('LOGIN')) return 'bg-inespasa-light/10 text-inespasa border-inespasa-light/20';
        if (action.includes('PASSWORD')) return 'bg-purple-50 text-purple-700 border-purple-100';
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }

    getActionIcon(action: string): string {
        if (action.includes('CREATE')) return 'lucidePlusCircle';
        if (action.includes('UPDATE')) return 'lucideEdit3';
        if (action.includes('DELETE')) return 'lucideTrash2';
        if (action.includes('LOGIN')) return 'lucideLogIn';
        if (action.includes('PASSWORD')) return 'lucideKey';
        if (action.includes('STATUS')) return 'lucideActivity';
        if (action.includes('SEED')) return 'lucideDatabase';
        return 'lucideHistory';
    }

    getModuleConfig(module: string) {
        const configs: Record<string, { label: string, color: string, icon: string }> = {
            'AUTH': { label: 'Seguridad', color: 'bg-inespasa-light/10 text-inespasa border-inespasa-light/20', icon: 'lucideShield' },
            'USUARIOS': { label: 'Usuarios', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'lucideUsers' },
            'USERS': { label: 'Usuarios', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'lucideUsers' },
            'NOTICIAS': { label: 'Noticias', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'lucideNewspaper' },
            'NEWS': { label: 'Noticias', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'lucideNewspaper' },
            'DENUNCIAS': { label: 'Denuncias', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'lucideAlertTriangle' },
            'complaints': { label: 'Denuncias', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'lucideAlertTriangle' },
            'COMPLAINTS': { label: 'Denuncias', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'lucideAlertTriangle' },
            'FESTIVOS': { label: 'Festivos', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'lucideCalendar' },
            'HOLIDAYS': { label: 'Festivos', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'lucideCalendar' },
            'POLICIES': { label: 'Políticas', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: 'lucideFileText' },
            'TIPOS_PERMISO': { label: 'Derechos', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'lucideTags' },
            'CONVENIO': { label: 'Convenio', color: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'lucideClipboardList' },
            'VACACIONES': { label: 'Vacaciones', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'lucideSun' },
            'VACATION': { label: 'Vacaciones', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'lucideSun' }
        };
        return configs[module] || { label: module, color: 'bg-gray-50 text-gray-700 border-gray-100', icon: 'lucideHistory' };
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
