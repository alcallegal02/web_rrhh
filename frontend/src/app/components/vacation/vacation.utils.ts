export class VacationUtils {
    static getIcon(type: string): string {
        const icons: Record<string, string> = {
            'vacaciones': 'lucidePalmtree',
            'asuntos_propios': 'lucideClipboardList',
            'medico_general': 'lucideHospital',
            'medico_especialista': 'lucideStethoscope',
            'dias_compensados': 'lucideScale',
            'licencia_retribuida': 'lucideFileText',
            'bolsa_horas': 'lucideClock',
            'horas_sindicales': 'lucideMegaphone',
            'teletrabajo': 'lucideHome',
            'visita_clientes': 'lucideHandshake',
            'baja_enfermedad': 'lucideThermometer',
            'baja_accidente': 'lucideAmbulance',
            'maternidad_paternidad': 'lucideBaby',
            'absentismo_no_retribuido': 'lucideBan',
            'licencia_no_retribuida': 'lucideBanknote',
            'enfermo_en_casa': 'lucideHome',
            'permisos': 'lucideKey'
        };
        return icons[type] || 'lucideFileText';
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
