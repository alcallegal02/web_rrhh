import { Component, signal, inject, ChangeDetectionStrategy, TemplateRef, ViewChild, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HolidayService } from '../../services/holiday.service';
import { Holiday, HolidayType, HolidayCreate, HolidayUpdate } from '../../interfaces/holiday.interface';
import { HolidayCalendarComponent } from './components/holiday-calendar/holiday-calendar.component';
import { HolidayListComponent } from './components/holiday-list/holiday-list.component';
import { HolidayFormComponent } from './components/holiday-form/holiday-form.component';
import { NgIconComponent } from '@ng-icons/core';

type ViewMode = 'calendar' | 'list';

@Component({
    selector: 'app-calendar-config',
    imports: [CommonModule, FormsModule, HolidayCalendarComponent, HolidayListComponent, HolidayFormComponent, NgIconComponent],
    templateUrl: './calendar-config.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarConfigComponent {
    selectedYear = signal(new Date().getFullYear());

    // Resource
    holidaysResource = rxResource({
        stream: () => this.holidayService.getHolidays(this.selectedYear())
    });

    holidays = computed(() => this.holidaysResource.value() ?? []);
    loading = computed(() => this.holidaysResource.isLoading());
    viewMode = signal<ViewMode>('calendar');

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
            // Ensure date string is YYYY-MM-DD
            const d = new Date(dateStr);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            this.initialDateForNew.set(`${year}-${month}-${day}`);
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
            this.openCreateModal(day.date.toISOString());
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
