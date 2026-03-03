import { Component, signal, inject, OnInit, ChangeDetectionStrategy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HolidayService } from '../../services/holiday.service';
import { Holiday, HolidayType, HolidayCreate, HolidayUpdate } from '../../interfaces/holiday.interface';
import { HolidayCalendarComponent } from './components/holiday-calendar/holiday-calendar.component';
import { HolidayListComponent } from './components/holiday-list/holiday-list.component';
import { HolidayFormComponent } from './components/holiday-form/holiday-form.component';

type ViewMode = 'calendar' | 'list';

@Component({
    selector: 'app-calendar-config',
    imports: [CommonModule, FormsModule, HolidayCalendarComponent, HolidayListComponent, HolidayFormComponent],
    templateUrl: './calendar-config.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarConfigComponent implements OnInit {
    holidays = signal<Holiday[]>([]);
    loading = signal(false);
    selectedYear = signal(new Date().getFullYear());
    viewMode = signal<ViewMode>('calendar');

    // Selected state for Modal
    selectedHoliday = signal<Holiday | null>(null);
    initialDateForNew = signal<string>('');
    isModalOpen = signal(false);

    private holidayService = inject(HolidayService);

    ngOnInit() {
        this.loadHolidays();
    }

    changeYear(delta: number) {
        this.selectedYear.update(y => y + delta);
        this.loadHolidays();
    }

    loadHolidays() {
        this.loading.set(true);
        this.holidayService.getHolidays(this.selectedYear()).subscribe({
            next: (data) => {
                this.holidays.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading holidays', err);
                this.loading.set(false);
            }
        });
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
        this.loading.set(true);
        this.holidayService.createHoliday(payload).subscribe({
            next: () => {
                this.loadHolidays();
                this.closeModal();
            },
            error: () => {
                alert('Error al guardar.');
                this.loading.set(false);
            }
        });
    }

    updateHoliday(id: string, payload: HolidayUpdate) {
        this.loading.set(true);
        this.holidayService.updateHoliday(id, payload).subscribe({
            next: () => {
                this.loadHolidays();
                this.closeModal();
            },
            error: () => {
                alert('Error al actualizar.');
                this.loading.set(false);
            }
        });
    }

    onDelete(holiday: Holiday) {
        if (!confirm(`¿Eliminar festivo "${holiday.name}"?`)) return;
        this.loading.set(true);
        this.holidayService.deleteHoliday(holiday.id).subscribe({
            next: () => {
                this.loadHolidays();
            },
            error: () => {
                alert('Error al eliminar');
                this.loading.set(false);
            }
        });
    }
}
