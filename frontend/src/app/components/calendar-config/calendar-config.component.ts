import { Component, signal, inject, ChangeDetectionStrategy, TemplateRef, ViewChild, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HolidayService } from '../../services/holiday.service';
import { Holiday, HolidayType, HolidayCreate, HolidayUpdate } from '../../interfaces/holiday.interface';
import { HolidayCalendarComponent } from './components/holiday-calendar/holiday-calendar.component';
import { HolidayListComponent } from './components/holiday-list/holiday-list.component';
import { HolidayFormComponent } from './components/holiday-form/holiday-form.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideCalendarDays, lucideChevronLeft, lucideChevronRight,
    lucidePlus, lucideTrash2, lucidePencil, lucideInfo
} from '@ng-icons/lucide';

// Previous ViewMode type removed as unified layout is now used

@Component({
    selector: 'app-calendar-config',
    imports: [FormsModule, HolidayCalendarComponent, HolidayListComponent, HolidayFormComponent, NgIconComponent],
    templateUrl: './calendar-config.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        provideIcons({ lucideCalendarDays, lucideChevronLeft, lucideChevronRight, lucidePlus, lucideTrash2, lucidePencil, lucideInfo })
    ]
})
export class CalendarConfigComponent {
    selectedYear = signal(new Date().getFullYear());

    // Resource
    holidaysResource = rxResource({
        stream: () => this.holidayService.getHolidays(this.selectedYear())
    });

    holidays = computed(() => this.holidaysResource.value() ?? []);
    loading = computed(() => this.holidaysResource.isLoading());

    // Selected state for Modal
    selectedHoliday = signal<Holiday | null>(null);
    initialDateForNew = signal<string>('');
    isModalOpen = signal(false);

    private holidayService = inject(HolidayService);

    constructor() { }

    changeYear(delta: number) {
        this.selectedYear.update(y => y + delta);
    }

    loadHolidays() {
        this.holidaysResource.reload();
    }

    // Modal Logic
    openCreateModal(dateStr?: string) {
        this.selectedHoliday.set(null); // Create mode
        if (dateStr) {
            this.initialDateForNew.set(dateStr);
        } else {
            this.initialDateForNew.set('');
        }
        this.isModalOpen.set(true);
    }

    openEditModal(holiday: Holiday) {
        this.selectedHoliday.set(holiday);
        this.isModalOpen.set(true);
    }

    closeModal() {
        this.isModalOpen.set(false);
        this.selectedHoliday.set(null);
    }

    // Calendar Interactions
    onDayClick(day: any) {
        if (day.day === 0) return;

        if (day.holiday) {
            this.openEditModal(day.holiday);
        } else {
            const d = day.date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            this.openCreateModal(`${year}-${month}-${date}`);
        }
    }

    // CRUD
    onSave(payload: HolidayCreate | HolidayUpdate) {
        const id = this.selectedHoliday()?.id;
        if (id) {
            this.updateHoliday(id, payload as HolidayUpdate);
        } else {
            this.createHoliday(payload as HolidayCreate);
        }
    }

    createHoliday(payload: HolidayCreate) {
        this.holidayService.createHoliday(payload).subscribe({
            next: () => {
                this.loadHolidays();
                this.closeModal();
            },
            error: () => {
                alert('Error al guardar.');
            }
        });
    }

    updateHoliday(id: string, payload: HolidayUpdate) {
        this.holidayService.updateHoliday(id, payload).subscribe({
            next: () => {
                this.loadHolidays();
                this.closeModal();
            },
            error: () => {
                alert('Error al actualizar.');
            }
        });
    }

    onDelete(holiday: Holiday) {
        if (!confirm(`¿Eliminar festivo "${holiday.name}"?`)) return;
        this.holidayService.deleteHoliday(holiday.id).subscribe({
            next: () => {
                this.loadHolidays();
            },
            error: () => {
                alert('Error al eliminar');
            }
        });
    }
}
