export type FilterType = 'text' | 'select' | 'multi-select' | 'date' | 'date-range' | 'toggle';

export interface FilterField {
  key: string;               // El campo del objeto que vamos a filtrar (ej: 'status')
  label: string;             // Texto para el usuario
  type: FilterType;          // Tipo de control
  options?: { label: string, value: any, icon?: string }[]; // Para selects
  placeholder?: string;
}

export interface FilterValue {
  [key: string]: any;
}

/**
 * Función de utilidad pura para filtrar cualquier array de datos
 */
export function applyFilters<T>(items: T[], filters: FilterValue): T[] {
  if (!items) return [];
  
  return items.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      // Si el filtro está vacío, no aplicamos restricción
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        return true;
      }

      const itemValue = (item as any)[key];

      // Lógica por tipo de valor
      if (typeof value === 'string' && typeof itemValue === 'string') {
        return itemValue.toLowerCase().includes(value.toLowerCase());
      }

      if (Array.isArray(value)) {
        return value.includes(itemValue);
      }

      if (value instanceof Date && itemValue) {
        const itemDate = new Date(itemValue);
        return itemDate.toDateString() === value.toDateString();
      }

      return itemValue === value;
    });
  });
}
