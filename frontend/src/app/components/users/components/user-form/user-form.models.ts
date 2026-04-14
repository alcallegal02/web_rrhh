export interface UserFormModel {
    id?: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    password?: string;
    role: string;
    department: string;
    position: string;
    parent_id?: string;
    photo_url: string;
    is_active?: boolean;
    contract_expiration_date?: string | null;
    contract_start_date?: string | null;
    percentage_jornada?: number;
    managers: string[];
    rrhh_ids: string[];
    attachments: { file_url: string, file_original_name: string }[];
    
    // Permissions & Notifications
    can_manage_complaints?: boolean;
    can_manage_news?: boolean;
    can_manage_holidays?: boolean;
    notif_own_requests?: boolean;
    notif_managed_requests?: boolean;
    notif_complaints?: boolean;
    notif_news?: boolean;
    password_plain?: string;

    // Rights
    vac_days?: number;
    vac_hours?: number;
    asuntos_propios_days?: number;
    asuntos_propios_hours?: number;
    dias_compensados_days?: number;
    dias_compensados_hours?: number;
    med_gral_days?: number;
    med_gral_hours?: number;
    med_especialista_days?: number;
    med_especialista_hours?: number;
    licencia_retribuida_days?: number;
    licencia_retribuida_hours?: number;
    bolsa_horas_days?: number;
    bolsa_horas_hours?: number;
    horas_sindicales_days?: number;
    horas_sindicales_hours?: number;

    created_at?: string;

    [key: string]: any;
}

export interface AllowanceConcept {
    label: string;
    days: string;
    hours: string;
}

export interface UserSummary {
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
    photo_url?: string;
}

export interface UserAttachment {
    file_url: string;
    file_original_name: string;
}
