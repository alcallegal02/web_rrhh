import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { AuditLog } from '../../../../services/audit.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideShield, lucideUsers, lucideNewspaper, lucideAlertTriangle,
    lucideCalendar, lucideFileText, lucideTags, lucideClipboardList,
    lucideSun, lucideActivity, lucidePlusCircle, lucideEdit3,
    lucideTrash2, lucideLogIn, lucideKey, lucideSettings,
    lucideChevronRight, lucideInbox, lucideChevronLeft, lucideHistory, lucideDatabase,
    lucideShieldAlert, lucideCheckCircle, lucideMessageSquareText, lucideUserPlus, 
    lucideUserCheck, lucideUserMinus, lucideFileEdit, lucideMailCheck
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
            lucideChevronRight, lucideInbox, lucideChevronLeft, lucideHistory, lucideDatabase,
            lucideShieldAlert, lucideCheckCircle, lucideMessageSquareText, lucideUserPlus,
            lucideUserCheck, lucideUserMinus, lucideFileEdit, lucideMailCheck
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
        const actionUpper = action.toUpperCase();
        if (actionUpper.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (actionUpper.includes('UPDATE') || actionUpper.includes('EDIT')) return 'bg-amber-50 text-amber-700 border-amber-100';
        if (actionUpper.includes('DELETE') || actionUpper.includes('REMOVE')) return 'bg-rose-50 text-rose-700 border-rose-100';
        if (actionUpper.includes('LOGIN_SUCCESS')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (actionUpper.includes('LOGIN_FAILED')) return 'bg-rose-50 text-rose-700 border-rose-100';
        if (actionUpper.includes('LOGIN')) return 'bg-inespasa-light/10 text-inespasa border-inespasa-light/20';
        if (actionUpper.includes('PASSWORD')) return 'bg-purple-50 text-purple-700 border-purple-100';
        if (actionUpper.includes('LOGOUT')) return 'bg-gray-100 text-gray-600 border-gray-200';
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }

    getActionIcon(action: string): string {
        const actionUpper = action.toUpperCase();
        if (actionUpper.includes('CREATE')) return 'lucidePlusCircle';
        if (actionUpper.includes('UPDATE') || actionUpper.includes('EDIT')) return 'lucideFileEdit';
        if (actionUpper.includes('DELETE') || actionUpper.includes('REMOVE')) return 'lucideTrash2';
        if (actionUpper.includes('LOGIN_SUCCESS')) return 'lucideCheckCircle';
        if (actionUpper.includes('LOGIN_FAILED')) return 'lucideShieldAlert';
        if (actionUpper.includes('LOGIN')) return 'lucideLogIn';
        if (actionUpper.includes('PASSWORD')) return 'lucideKey';
        if (actionUpper.includes('STATUS')) return 'lucideActivity';
        if (actionUpper.includes('SEED')) return 'lucideDatabase';
        if (actionUpper.includes('EMAIL') || actionUpper.includes('MAIL')) return 'lucideMailCheck';
        return 'lucideHistory';
    }

    getModuleConfig(module: string) {
        const mod = module.toUpperCase();
        const configs: Record<string, { label: string, color: string, icon: string }> = {
            'AUTH': { label: 'Seguridad', color: 'bg-inespasa-light/10 text-inespasa border-inespasa-light/20', icon: 'lucideShield' },
            'USUARIOS': { label: 'Usuarios', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'lucideUsers' },
            'USERS': { label: 'Usuarios', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'lucideUsers' },
            'NOTICIAS': { label: 'Noticias', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'lucideNewspaper' },
            'NEWS': { label: 'Noticias', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'lucideNewspaper' },
            'DENUNCIAS': { label: 'Canal de Denuncias', color: 'bg-rose-50 text-rose-700 border-rose-100', icon: 'lucideMessageSquareText' },
            'COMPLAINTS': { label: 'Canal de Denuncias', color: 'bg-rose-50 text-rose-700 border-rose-100', icon: 'lucideMessageSquareText' },
            'FESTIVOS': { label: 'Festivos', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'lucideCalendar' },
            'HOLIDAYS': { label: 'Festivos', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'lucideCalendar' },
            'POLICIES': { label: 'Políticas', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'lucideFileText' },
            'TIPOS_PERMISO': { label: 'Derechos', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'lucideTags' },
            'CONVENIO': { label: 'Convenio', color: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'lucideClipboardList' },
            'VACACIONES': { label: 'Vacaciones', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'lucideSun' },
            'VACATION': { label: 'Vacaciones', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'lucideSun' },
            'AUDIT': { label: 'Auditoría', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: 'lucideHistory' }
        };
        return configs[mod] || { label: module, color: 'bg-gray-50 text-gray-700 border-gray-100', icon: 'lucideHistory' };
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
