import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideLayers, lucideShield, lucideUsers, lucideNewspaper, lucideAlertTriangle,
    lucideCalendar, lucideFileText, lucideTags, lucideClipboardList, lucideSun,
    lucideZap, lucidePlusCircle, lucideEdit3, lucideTrash2, lucideLogIn,
    lucideShieldAlert, lucideKey, lucideActivity, lucideDatabase,
    lucideCalendarRange, lucideClock, lucideHistory, lucideRefreshCw
} from '@ng-icons/lucide';

@Component({
    selector: 'app-audit-filters',
    imports: [CommonModule, FormsModule, NgIconComponent],
    templateUrl: './audit-filters.component.html',
    providers: [
        provideIcons({
            lucideLayers, lucideShield, lucideUsers, lucideNewspaper, lucideAlertTriangle,
            lucideCalendar, lucideFileText, lucideTags, lucideClipboardList, lucideSun,
            lucideZap, lucidePlusCircle, lucideEdit3, lucideTrash2, lucideLogIn,
            lucideShieldAlert, lucideKey, lucideActivity, lucideDatabase,
            lucideCalendarRange, lucideClock, lucideHistory, lucideRefreshCw
        })
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditFiltersComponent {
    filtersChanged = output<{
        module: string[],
        action: string[],
        start_date?: string,
        end_date?: string
    }>();

    selectedModules = signal<string[]>([]);
    selectedActions = signal<string[]>([]);
    filterStartDate = signal('');
    filterEndDate = signal('');

    modules = [
        { value: 'AUTH', label: 'Seguridad', icon: 'lucideShield' },
        { value: 'USUARIOS', label: 'Usuarios', icon: 'lucideUsers' },
        { value: 'NOTICIAS', label: 'Noticias', icon: 'lucideNewspaper' },
        { value: 'DENUNCIAS', label: 'Denuncias', icon: 'lucideAlertTriangle' },
        { value: 'FESTIVOS', label: 'Festivos', icon: 'lucideCalendar' },
        { value: 'POLICIES', label: 'Políticas', icon: 'lucideFileText' },
        { value: 'TIPOS_PERMISO', label: 'Tipos de Permiso', icon: 'lucideTags' },
        { value: 'CONVENIO', label: 'Convenio', icon: 'lucideClipboardList' },
        { value: 'VACACIONES', label: 'Vacaciones', icon: 'lucideSun' }
    ];

    actions = [
        { value: 'CREATE', label: 'Creación', icon: 'lucidePlusCircle' },
        { value: 'UPDATE', label: 'Actualización', icon: 'lucideEdit3' },
        { value: 'DELETE', label: 'Eliminación', icon: 'lucideTrash2' },
        { value: 'LOGIN_SUCCESS', label: 'Inicio Sesión (Éxito)', icon: 'lucideLogIn' },
        { value: 'LOGIN_FAILED', label: 'Inicio Sesión (Fallo)', icon: 'lucideShieldAlert' },
        { value: 'PASSWORD_CHANGED', label: 'Cambio Contraseña', icon: 'lucideKey' },
        { value: 'STATUS_CHANGE', label: 'Cambio Estado', icon: 'lucideActivity' },
        { value: 'SEED', label: 'Semilla', icon: 'lucideDatabase' }
    ];

    setQuickRange(type: 'hour' | 'today' | 'yesterday' | 'week') {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        if (type === 'hour') {
            start.setHours(now.getHours() - 1);
        } else if (type === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (type === 'yesterday') {
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        } else if (type === 'week') {
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
        }

        this.filterStartDate.set(this.formatToLocalISO(start));
        this.filterEndDate.set(this.formatToLocalISO(end));
        this.applyFilters();
    }

    private formatToLocalISO(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    toggleModule(moduleValue: string) {
        const current = this.selectedModules();
        if (current.includes(moduleValue)) {
            this.selectedModules.set(current.filter(m => m !== moduleValue));
        } else {
            this.selectedModules.set([...current, moduleValue]);
        }
        this.applyFilters();
    }

    toggleAction(actionValue: string) {
        const current = this.selectedActions();
        if (current.includes(actionValue)) {
            this.selectedActions.set(current.filter(a => a !== actionValue));
        } else {
            this.selectedActions.set([...current, actionValue]);
        }
        this.applyFilters();
    }

    applyFilters() {
        this.filtersChanged.emit({
            module: this.selectedModules(),
            action: this.selectedActions(),
            start_date: this.filterStartDate() || undefined,
            end_date: this.filterEndDate() || undefined
        });
    }

    clearFilters() {
        this.selectedModules.set([]);
        this.selectedActions.set([]);
        this.filterStartDate.set('');
        this.filterEndDate.set('');
        this.applyFilters();
    }
}
