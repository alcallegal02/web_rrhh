import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { Holiday, HolidayType } from '../../../../interfaces/holiday.interface';

interface CalendarDay {
    date: Date;
    day: number;
    isToday: boolean;
    isWeekend: boolean;
    holiday?: Holiday;
}

@Component({
    selector: 'app-holiday-calendar',
    imports: [],
    templateUrl: './holiday-calendar.component.html',
    styleUrl: './holiday-calendar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HolidayCalendarComponent {
    holidays = input.required<Holiday[]>();
    year = input.required<number>();

    dayClick = output<CalendarDay>();

    monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    calendarMonths = computed(() => {
        const year = this.year();
        const months: { month: number; name: string; days: CalendarDay[] }[] = [];

        for (let month = 0; month < 12; month++) {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const days: CalendarDay[] = [];

            const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
            for (let i = 0; i < firstDayOfWeek; i++) {
                days.push({ date: new Date(year, month, 0), day: 0, isToday: false, isWeekend: false });
            }

            for (let day = 1; day <= lastDay.getDate(); day++) {
                const date = new Date(year, month, day);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const holiday = this.holidays().find(h => h.date === dateStr);

                days.push({
                    date,
                    day,
                    isToday: this.isToday(date),
                    isWeekend,
                    holiday
                });
            }
            months.push({ month, name: this.monthNames[month], days });
        }
        return months;
    });

    isToday(d: Date): boolean {
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }

    getDayClass(day: CalendarDay): string {
        if (day.day === 0) return 'invisible';

        if (day.holiday) {
            switch (day.holiday.holiday_type) {
                case HolidayType.NATIONAL: return 'bg-red-400 text-white shadow-lg shadow-red-200 cursor-pointer hover:bg-red-500';
                case HolidayType.REGIONAL: return 'bg-blue-400 text-white shadow-lg shadow-blue-200 cursor-pointer hover:bg-blue-500';
                case HolidayType.LOCAL: return 'bg-green-400 text-white shadow-lg shadow-green-200 cursor-pointer hover:bg-green-500';
                case HolidayType.OTHER: return 'bg-gray-400 text-white cursor-pointer hover:bg-gray-500';
                default: return 'bg-purple-400 text-white cursor-pointer';
            }
        }

        if (day.isWeekend) return 'bg-gray-50 text-gray-300 cursor-default';
        if (day.isToday) return 'ring-2 ring-[#3C65AB] text-[#3C65AB] font-black cursor-pointer bg-blue-50/50';

        return 'text-gray-600 hover:bg-blue-50 hover:text-[#3C65AB] cursor-pointer transition-all duration-300 font-medium';
    }
}
