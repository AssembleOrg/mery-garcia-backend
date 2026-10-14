/**
 * Totales de caja por medio de pago, día por día, para Costear. Lógica pura:
 * recibe las filas ya agregadas por SQL y arma la respuesta.
 *
 * - Ingresos: comandas de ingreso validadas o traspasadas, por medio de pago
 *   (las líneas de la comanda; si no tiene, las de sus ítems; si no tiene
 *   ninguna, el precio de la comanda como "SIN_DETALLE").
 * - Pendientes: comandas de ingreso todavía pendientes, aparte (por cobrar).
 * - Señas: prepagos activos o utilizados, el día en que se crearon. Al usarse
 *   en una comanda no se vuelven a contar: la comanda solo trae lo que pagó.
 * - Egresos: no tienen medio de pago; van por caja y moneda.
 */

export type Moneda = 'ARS' | 'USD';
export type Montos = Record<Moneda, number>;
export type PorClave = Record<string, Montos>;

export interface Bloque {
  ingresos: PorClave;
  pendientes: PorClave;
  senas: PorClave;
  egresos: PorClave;
  cantidad: {
    comandas: number;
    pendientes: number;
    senas: number;
    egresos: number;
  };
}

export interface Dia extends Bloque {
  fecha: string;
}

export interface CajaTotales {
  desde: string;
  hasta: string;
  zona: string;
  generadoEn: string;
  totales: Bloque;
  dias: Dia[];
}

/** Una fila agregada: día AR, a qué bloque va, la clave (medio o caja), moneda y monto. */
export interface FilaMonto {
  dia: string;
  bloque: 'ingresos' | 'pendientes' | 'senas' | 'egresos';
  clave: string;
  moneda: string;
  monto: number | string;
}

export interface FilaCantidad {
  dia: string;
  bloque: keyof Bloque['cantidad'];
  n: number | string;
}

export const ZONA = 'America/Argentina/Buenos_Aires';
const DIA = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DIAS = 400;

const vacio = (): Bloque => ({
  ingresos: {},
  pendientes: {},
  senas: {},
  egresos: {},
  cantidad: { comandas: 0, pendientes: 0, senas: 0, egresos: 0 },
});

const redondear = (n: number) => Math.round(n * 100) / 100;

function sumar(
  destino: PorClave,
  clave: string,
  moneda: Moneda,
  monto: number,
) {
  const m = (destino[clave] ??= { ARS: 0, USD: 0 });
  m[moneda] = redondear(m[moneda] + monto);
}

/** Valida el rango y devuelve los días que abarca (incluidos). */
export function diasDelRango(desde: string, hasta: string): string[] {
  if (!DIA.test(desde) || !DIA.test(hasta))
    throw new Error('Las fechas van como AAAA-MM-DD.');
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (
    Number.isNaN(a) ||
    Number.isNaN(b) ||
    new Date(a).toISOString().slice(0, 10) !== desde ||
    new Date(b).toISOString().slice(0, 10) !== hasta
  ) {
    throw new Error('Alguna de las fechas no existe.');
  }
  if (b < a) throw new Error('La fecha "hasta" es anterior a "desde".');
  const n = Math.round((b - a) / 86_400_000) + 1;
  if (n > MAX_DIAS)
    throw new Error(`El rango puede tener hasta ${MAX_DIAS} días.`);
  return Array.from({ length: n }, (_, i) =>
    new Date(a + i * 86_400_000).toISOString().slice(0, 10),
  );
}

export function armarTotales(
  desde: string,
  hasta: string,
  montos: FilaMonto[],
  cantidades: FilaCantidad[],
  ahora = new Date(),
): CajaTotales {
  const dias = diasDelRango(desde, hasta);
  const porDia = new Map<string, Bloque>(dias.map((d) => [d, vacio()]));
  const totales = vacio();
  for (const f of montos) {
    const moneda =
      f.moneda === 'USD' ? 'USD' : f.moneda === 'ARS' ? 'ARS' : null;
    const monto = Number(f.monto);
    const dia = porDia.get(f.dia);
    if (!moneda || !dia || !Number.isFinite(monto) || monto === 0) continue;
    sumar(dia[f.bloque], f.clave, moneda, monto);
    sumar(totales[f.bloque], f.clave, moneda, monto);
  }
  for (const f of cantidades) {
    const dia = porDia.get(f.dia);
    if (!dia) continue;
    dia.cantidad[f.bloque] += Number(f.n);
    totales.cantidad[f.bloque] += Number(f.n);
  }
  return {
    desde,
    hasta,
    zona: ZONA,
    generadoEn: ahora.toISOString(),
    totales,
    dias: dias.map((fecha) => ({ fecha, ...porDia.get(fecha)! })),
  };
}
