export class VacationUtils {
    static getIcon(type: string): string {
        const icons: Record<string, string> = {
            'vacaciones': '🏖️',
            'asuntos_propios': '📋',
            'medico_general': '🏥',
            'medico_especialista': '🩺',
            'dias_compensados': '⚖️',
            'licencia_retribuida': '📝',
            'bolsa_horas': '💰',
            'horas_sindicales': '📢',
            'teletrabajo': '🏠',
            'visita_clientes': '🤝',
            'baja_enfermedad': '🤒',
            'baja_accidente': '🚑',
            'maternidad_paternidad': '👶',
            'absentismo_no_retribuido': '🚫',
            'licencia_no_retribuida': '💸',
            'enfermo_en_casa': '🏠',
            'permisos': '🔑'
        };
        return icons[type] || '📄';
    }

    static getStatusClass(status: string): string {
        const classes: Record<string, string> = {
            'approved_rrhh': 'bg-green-100 text-green-700',
            'accepted': 'bg-green-100 text-green-700',
            'pending': 'bg-yellow-100 text-yellow-700',
            'rejected': 'bg-red-100 text-red-700',
            'borrador': 'bg-gray-100 text-gray-700'
        };
        return classes[status] || 'bg-blue-100 text-blue-700';
    }

    static convertToTime(days: any, dailyWorkHours: number = 8): string {
        if (!days) return '0h 0m';
        if (typeof days === 'string' && days.includes(':')) return days.replace(':', 'h ') + 'm';

        const factor = dailyWorkHours || 8;
        const hours = Number(days) * factor;
        const totalMinutes = Math.round(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h ${m}m`;
    }

    static isDuration(v: any): boolean {
        return typeof v === 'string' && v.includes(':');
    }
}
