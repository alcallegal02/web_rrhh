import { Complaint } from '../../../models/app.models';
import { BadgeVariant } from '../../../shared/components/status-badge/status-badge.component';

export type ComplaintStatus = 'entregada' | 'pendiente' | 'en_analisis' | 'en_investigacion' | 'informacion_requerida' | 'resuelta' | 'desestimada';

export interface StatusOption {
  value: ComplaintStatus;
  label: string;
  icon: string;
  iconColor: string;
}

export const COMPLAINT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'entregada', label: 'Entregada', icon: 'lucidePackageCheck', iconColor: 'text-gray-400' },
  { value: 'pendiente', label: 'Pendiente', icon: 'lucideClock', iconColor: 'text-amber-500' },
  { value: 'en_analisis', label: 'En Análisis', icon: 'lucideSearch', iconColor: 'text-blue-500' },
  { value: 'en_investigacion', label: 'En Investigación', icon: 'lucideShieldAlert', iconColor: 'text-purple-500' },
  { value: 'informacion_requerida', label: 'Info. Requerida', icon: 'lucideMessageSquareText', iconColor: 'text-orange-500' },
  { value: 'resuelta', label: 'Resuelta', icon: 'lucideCheckCircle', iconColor: 'text-emerald-500' },
  { value: 'desestimada', label: 'Desestimada', icon: 'lucideXCircle', iconColor: 'text-red-500' }
];

export function getStatusOption(status: string): StatusOption | undefined {
  return COMPLAINT_STATUS_OPTIONS.find(opt => opt.value === status);
}

export function getStatusLabel(status: string): string {
  return getStatusOption(status)?.label || status;
}

export function getStatusIcon(status: string): string {
  return getStatusOption(status)?.icon || 'lucideScale';
}

export function getStatusIconColor(status: string): string {
  return getStatusOption(status)?.iconColor || 'text-gray-400';
}

export function getStatusVariant(status: string): BadgeVariant {
  const variants: Record<string, BadgeVariant> = {
    'entregada': 'neutral',
    'pendiente': 'warning',
    'en_analisis': 'info',
    'en_investigacion': 'purple',
    'informacion_requerida': 'indigo',
    'resuelta': 'success',
    'desestimada': 'error'
  };
  return variants[status] || 'neutral';
}

export function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'entregada': 'bg-gray-50 text-gray-700 border-gray-200',
    'pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
    'en_analisis': 'bg-blue-50 text-blue-700 border-blue-200',
    'en_investigacion': 'bg-purple-50 text-purple-700 border-purple-200',
    'informacion_requerida': 'bg-orange-50 text-orange-700 border-orange-200',
    'resuelta': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'desestimada': 'bg-red-50 text-red-700 border-red-200'
  };
  return classes[status] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export function getStatusStripeClass(status: string): string {
  const classes: Record<string, string> = {
    'entregada': 'bg-gray-300',
    'pendiente': 'bg-amber-400',
    'en_analisis': 'bg-blue-500',
    'en_investigacion': 'bg-purple-500',
    'informacion_requerida': 'bg-orange-500',
    'resuelta': 'bg-emerald-500',
    'desestimada': 'bg-red-500'
  };
  return classes[status] || 'bg-gray-300';
}

/**
 * Por qué esta estructura es más escalable:
 * Centraliza la lógica de estados de denuncias, evitando duplicidad en componentes (DRY)
 * y facilitando cambios globales en la nomenclatura o iconografía de los estados.
 */

export function calculateEmbeddedImagesSize(html: string): number {
  if (!html) return 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');
  let totalSize = 0;
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('data:image')) {
      const base64Data = src.split(',')[1];
      if (base64Data) {
        totalSize += (base64Data.length * 3) / 4;
      }
    }
  });
  return totalSize;
}
