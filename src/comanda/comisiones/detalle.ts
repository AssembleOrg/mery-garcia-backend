/**
 * Detalle de la comisión renglón por renglón: qué hizo la trabajadora, sobre
 * qué monto comisiona y cuánto le toca. Sale del mismo cálculo que el total
 * (calcularComisionesTrabajadores), así el resumen del día en Ritmo y la
 * pantalla de Comisiones dicen lo mismo.
 */
export type TipoLineaComision = 'SERVICIO' | 'PRODUCTO' | 'NO_ASISTIO';

export interface LineaComision {
  comandaId: string;
  numero: string;
  /** AAAA-MM-DD y HH:mm en la zona del salón. */
  dia: string;
  hora: string;
  cliente: string | null;
  validada: boolean;
  tipo: TipoLineaComision;
  item: string;
  categoria: string | null;
  cantidad: number;
  moneda: 'ARS' | 'USD';
  /** Sobre qué se calcula: monto base × cantidad, precio cobrado o seña. */
  base: number;
  porcentaje: number;
  porcentajeMax: number;
  confirmado: boolean;
  comision: number;
  comisionMax: number;
  /** Calculada con el esquema por base fija (si no, cálculo histórico). */
  esquemaBase: boolean;
  /** "consulta", "sin base cargada": por qué no comisiona, si no lo hace. */
  nota: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineaComision(
  l: Omit<LineaComision, 'comision' | 'comisionMax'>,
): LineaComision {
  return {
    ...l,
    base: r2(l.base),
    comision: r2((l.base * l.porcentaje) / 100),
    comisionMax: r2((l.base * l.porcentajeMax) / 100),
  };
}
