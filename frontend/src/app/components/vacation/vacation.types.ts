import { Holiday, VacationRequest } from '../../models/app.models';

export interface CalendarDay {
    date: Date;
    day: number;
    isToday: boolean;
    isWeekend: boolean;
    holiday?: Holiday;
    request?: VacationRequest;
    isInRange?: boolean;
}
