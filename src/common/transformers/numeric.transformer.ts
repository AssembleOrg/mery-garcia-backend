/**
 * Transformer para manejar valores numéricos de PostgreSQL
 * Convierte automáticamente los strings a números cuando se leen de la base de datos
 */
export const NumericTransformer = {
  to: (value: number | string | null): number | null => {
    if (value === null || value === undefined) return null;
    return Number(value);
  },
  
  from: (value: string | number | null): number | null => {
    if (value === null || value === undefined) return null;
    return Number(value);
  }
}; 