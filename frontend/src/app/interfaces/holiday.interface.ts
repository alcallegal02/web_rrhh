export enum HolidayType {
    NATIONAL = 'nacional',
    LOCAL = 'local',
    CONVENIO = 'convenio',
    REGIONAL = 'regional',
    OTHER = 'otros'
}

export interface Holiday {
    id: string;
    date: string;
    name: string;
    description?: string;
    holiday_type: HolidayType;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface HolidayCreate {
    date: string;
    name: string;
    description?: string;
    holiday_type: HolidayType;
}

export interface HolidayUpdate {
    date?: string;
    name?: string;
    description?: string;
    holiday_type?: HolidayType;
}
