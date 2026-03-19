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

export interface VacationRequestDraft {
    id: string;
    request_type: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_requested: number | string;
    assigned_manager_id: string;
    assigned_rrhh_id: string;
    description: string;
    file_url: string;
    attachments: any[];
}
