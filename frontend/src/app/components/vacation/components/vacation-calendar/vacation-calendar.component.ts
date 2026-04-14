import { Component, ChangeDetectionStrategy, input, output, signal, HostListener } from '@angular/core';
import { CalendarDay } from '../../vacation.types';
import { VacationUtils } from '../../vacation.utils';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-vacation-calendar',
    imports: [NgIconComponent],
    templateUrl: './vacation-calendar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacationCalendarComponent {
    currentYear = input.required<number>();
    calendarMonths = input.required<{ month: number; name: string; days: CalendarDay[] }[]>();
    selectedRange = input<{start: CalendarDay, end: CalendarDay} | null>(null);

    yearChange = output<number>();
    rangeSelected = output<{start: CalendarDay, end: CalendarDay}>();

    isDragging = signal(false);
    dragStart = signal<CalendarDay | null>(null);
    dragCurrent = signal<CalendarDay | null>(null);

    weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    getIcon = VacationUtils.getIcon;

    changeYear(delta: number) {
        this.yearChange.emit(delta);
    }

    onMouseDown(day: CalendarDay) {
        if (day.day === 0) return;
        this.isDragging.set(true);
        this.dragStart.set(day);
        this.dragCurrent.set(day);
    }

    onMouseEnter(day: CalendarDay) {
        if (!this.isDragging() || day.day === 0) return;
        this.dragCurrent.set(day);
    }

    @HostListener('document:mouseup')
    onDocumentMouseUp() {
        if (this.isDragging()) {
            if (this.dragStart() && this.dragCurrent()) {
                const start = this.dragStart()!;
                const end = this.dragCurrent()!;
                const [actualStart, actualEnd] = start.date <= end.date ? [start, end] : [end, start];
                this.rangeSelected.emit({ start: actualStart, end: actualEnd });
            }
            this.isDragging.set(false);
            this.dragStart.set(null);
            this.dragCurrent.set(null);
        }
    }

    getDayClass(day: CalendarDay): string {
        if (day.day === 0) return 'invisible';

        let classes = 'cursor-pointer transition-colors relative select-none ';

        const start = this.dragStart();
        const curr = this.dragCurrent();
        const isDragging = this.isDragging();
        let isSelectedMode = false;

        const sRange = this.selectedRange();

        if (isDragging && start && curr) {
            const minDate = start.date <= curr.date ? start.date : curr.date;
            const maxDate = start.date >= curr.date ? start.date : curr.date;
            
            if (day.date >= minDate && day.date <= maxDate) {
                isSelectedMode = true;
                classes += ' bg-blue-500 text-white font-bold shadow-inner ring-2 ring-blue-600 scale-105 z-10 rounded-lg ';
            }
        } else if (!isDragging && sRange) {
            if (day.date >= sRange.start.date && day.date <= sRange.end.date) {
                isSelectedMode = true;
                classes += ' bg-blue-500 text-white font-bold shadow-inner ring-2 ring-blue-600 scale-105 z-10 rounded-lg ';
            }
        }

        if (!isSelectedMode) {
            classes += ' hover:bg-gray-100 hover:scale-110 hover:z-10 rounded-lg ';
            if (day.isToday) classes += ' ring-2 ring-blue-500 ring-offset-1 font-bold ';
            if (day.isWeekend) classes += ' text-gray-400 bg-gray-50 ';
        }

        if (day.holiday) {
            classes += ' bg-red-50 text-red-600 font-bold border border-red-100 ';
        }

        if (day.request) {
            if (day.request.status === 'approved_rrhh' || day.request.status === 'accepted') {
                classes += ' bg-green-100 text-green-700 font-bold border border-green-200 ';
            } else if (day.request.status === 'pending') {
                classes += ' bg-yellow-100 text-yellow-700 font-bold border border-yellow-200 ';
            } else if (day.request.status === 'borrador') {
                classes += ' bg-gray-200/50 text-gray-500 border border-dashed border-gray-300 ';
            } else if (day.request.status === 'rejected') {
                classes += ' bg-red-100/50 text-red-400 line-through ';
            }
        }

        return classes;
    }
}
