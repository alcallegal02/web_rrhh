export interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    attachments?: any[]; // Using any[] to avoid circular dependency for now, or define UserAttachment
    can_manage_complaints?: boolean;
    notif_own_requests?: boolean;
    notif_managed_requests?: boolean;
    notif_complaints?: boolean;
}

export interface NewsAttachment {
    id: string;
    news_id: string;
    file_url: string;
    file_original_name?: string;
    created_at: string;
}

export interface NewsCarouselImage {
    id: string;
    news_id: string;
    file_url: string;
    order: number;
    created_at: string;
}

export interface News {
    id: string;
    title: string;
    summary?: string;
    content: string;
    cover_image_url?: string | null;
    author_id: string;
    status: 'borrador' | 'publicada' | 'archivada';
    publish_date?: string;
    attachments: NewsAttachment[];
    carousel_images: NewsCarouselImage[];
    created_at: string;
    updated_at: string;
}

export interface VacationAttachment {
    id: string;
    request_id: string;
    file_url: string;
    file_original_name?: string;
    created_at: string;
}

export interface VacationRequest {
    id: string;
    user_id: string;
    user_name?: string;
    request_type: string;
    leave_type_id?: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    status: 'borrador' | 'pending' | 'approved_manager' | 'rejected_manager' | 'approved_rrhh' | 'rejected_rrhh' | 'accepted' | 'rejected';
    assigned_manager_id?: string;
    assigned_manager_name?: string;
    assigned_rrhh_id?: string;
    assigned_rrhh_name?: string;
    manager_approved_at?: string;
    manager_approved_by?: string;
    rrhh_approved_at?: string;
    rrhh_approved_by?: string;
    rejection_reason?: string;
    description?: string;
    file_url?: string;
    attachments: VacationAttachment[];
    policy_id?: string;
    causal_date?: string;
    child_name?: string;
    child_birthdate?: string;
    telework_percentage?: number;
    created_at: string;
    updated_at?: string; // Optional because API might not always return it or we might not need it for all lists
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

export interface Holiday {
    id: string;
    name: string;
    date: string;
    description?: string;
}

export interface CommentAttachment {
    id: string;
    comment_id: string;
    file_url: string;
    file_original_name?: string;
    created_at: string;
}

export interface ComplaintComment {
    id: string;
    complaint_id: string;
    user_id?: string;
    user_name?: string;
    content: string;
    is_public: boolean;
    complaint_status: string;
    attachments: CommentAttachment[];
    created_at: string;
}

export interface ComplaintAttachment {
    id: string;
    complaint_id: string;
    file_url: string;
    file_original_name?: string;
    created_at: string;
}

export interface Complaint {
    id: string;
    code: string;
    title: string;
    description: string;
    file_path?: string; // Legacy
    file_original_name?: string; // Legacy
    status: 'entregada' | 'pendiente' | 'en_analisis' | 'en_investigacion' | 'informacion_requerida' | 'resuelta' | 'desestimada';
    status_public_description?: string;
    admin_response?: string;
    attachments: ComplaintAttachment[];
    comments: ComplaintComment[];
    created_at: string;
    updated_at?: string;
}
