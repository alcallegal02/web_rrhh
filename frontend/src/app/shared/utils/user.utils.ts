import { environment } from '../../config/environment';
import { UserFormModel } from '../../components/users/components/user-form/user-form.models';

/** Proporción de año que corresponde al contrato activo. */
export function calculateContractProportion(
  contractType: 'indefinite' | 'temporary',
  form: UserFormModel
): number {
  if (contractType === 'indefinite') return 1.0;
  if (!form.contract_expiration_date) return 0;

  const end = new Date(form.contract_expiration_date);
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  let effectiveStart = startOfYear;

  if (form.created_at) {
    const createdAt = new Date(form.created_at);
    if (createdAt.getFullYear() === currentYear && createdAt > startOfYear) {
      effectiveStart = createdAt;
    }
  } else if (!form.id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today > startOfYear) effectiveStart = today;
  }

  const diffDays = Math.max(0, Math.ceil((end.getTime() - effectiveStart.getTime()) / 86_400_000) + 1);
  return Math.min(1.0, diffDays / 365);
}

/** Calcula todos los derechos de ausencia aplicando la proporción del contrato. */
export function calculateAllowanceRights(
  form: UserFormModel,
  contractType: 'indefinite' | 'temporary',
  config: any
): Partial<UserFormModel> {
  const proportion = calculateContractProportion(contractType, form);
  const calcHours = (base: number) => Number((base * proportion).toFixed(4));
  const calcDays = (hours: number) => Number((hours / (config.daily_work_hours || 8)).toFixed(4));

  return {
    vac_days: Math.ceil(config.vacation_days_annual * proportion),
    vac_hours: Number((Math.ceil(config.vacation_days_annual * proportion) * config.daily_work_hours).toFixed(3)),
    asuntos_propios_hours: calcHours(config.asuntos_propios_hours_annual || 0),
    asuntos_propios_days: calcDays(calcHours(config.asuntos_propios_hours_annual || 0)),
    dias_compensados_hours: calcHours(config.dias_compensados_hours_annual || 0),
    dias_compensados_days: calcDays(calcHours(config.dias_compensados_hours_annual || 0)),
    med_gral_hours: calcHours(config.med_gral_hours_annual || 0),
    med_gral_days: calcDays(calcHours(config.med_gral_hours_annual || 0)),
    med_especialista_hours: calcHours(config.med_especialista_hours_annual || 0),
    med_especialista_days: calcDays(calcHours(config.med_especialista_hours_annual || 0)),
    licencia_retribuida_hours: calcHours(config.licencia_retribuida_hours_annual || 0),
    licencia_retribuida_days: calcDays(calcHours(config.licencia_retribuida_hours_annual || 0)),
    bolsa_horas_hours: calcHours(config.bolsa_horas_hours_annual || 0),
    bolsa_horas_days: calcDays(calcHours(config.bolsa_horas_hours_annual || 0)),
    horas_sindicales_hours: calcHours(config.horas_sindicales_hours_annual || 0),
    horas_sindicales_days: calcDays(calcHours(config.horas_sindicales_hours_annual || 0)),
  };
}

/** Construye la URL absoluta de un archivo de usuario (foto o adjunto). */
export function getUserFileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${environment.apiUrl.replace('/api/v1', '')}/${path}`;
}

// Por qué esta estructura es más escalable:
// Las funciones puras no dependen de ningún componente/servicio, son testeables de forma aislada
// y pueden reutilizarse en cualquier parte de la app sin acoplamiento.
