import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarDay } from '../../vacation.types';
import { VacationUtils } from '../../vacation.utils';

@Component({
    selector: 'app-vacation-calendar',
    imports: [CommonModule],
    templateUrl: './vacation-calendar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacationCalendarComponent {
    currentYear = input.required<number>();
    calendarMonths = input.required<{ month: number; name: string; days: CalendarDay[] }[]>();

    yearChange = output<number>();
    daySelected = output<CalendarDay>();

    weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    getIcon = VacationUtils.getIcon;

    changeYear(delta: number) {
        this.yearChange.emit(delta);
    }

    openDayModal(day: CalendarDay) {
        if (day.day !== 0) {
            this.daySelected.emit(day);
        }
    }

    getDayClass(day: CalendarDay): string {
        if (day.day === 0) return 'invisible';

        let classes = 'cursor-pointer hover:bg-gray-100 transition-colors relative ';

        if (day.isToday) classes += ' ring-2 ring-blue-500 ring-offset-1 font-bold ';
        if (day.isWeekend) classes += ' text-gray-400 bg-gray-50 ';

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
