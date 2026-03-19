/** Mapeo de estados de denuncia a etiquetas legibles. */
const STATUS_LABELS: Record<string, string> = {
  entregada: 'Entregada',
  pendiente: 'Pendiente',
  en_analisis: 'En Análisis',
  en_investigacion: 'En Investigación',
  informacion_requerida: 'Información Requerida',
  resuelta: 'Resuelta',
  desestimada: 'Desestimada',
};

/** Mapeo de estados de denuncia a clases CSS de Tailwind. */
const STATUS_CLASSES: Record<string, string> = {
  entregada: 'bg-gray-50 text-gray-700 border-gray-200',
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  en_analisis: 'bg-blue-50 text-blue-700 border-blue-200',
  en_investigacion: 'bg-purple-50 text-purple-700 border-purple-200',
  informacion_requerida: 'bg-orange-50 text-orange-700 border-orange-200',
  resuelta: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  desestimada: 'bg-red-50 text-red-700 border-red-200',
};

/** Devuelve la etiqueta legible de un estado de denuncia. */
export function getComplaintStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Devuelve las clases CSS de Tailwind para un estado de denuncia dado. */
export function getComplaintStatusClass(status: string): string {
  return STATUS_CLASSES[status] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}

// Por qué esta estructura es más escalable:
// Los mapas de lookup son O(1) y centralizan la lógica de presentación de estados,
// evitando duplicación entre complaint-status y complaint-management components.
