/**
 * Detalle de un día para Costear (lo que hay detrás de los totales de
 * `caja-totales`): cada comanda de ingreso con sus pagos e ítems, cada seña y
 * cada egreso con su caja. Mismos filtros que los totales, así los números
 * cierran. Lógica pura: recibe las filas de SQL y arma la respuesta.
 */
import { diasDelRango, Moneda, Montos, ZONA } from './caja-totales';

export interface PagoLinea {
  tipo: string;
  moneda: Moneda;
  monto: number;
}

export interface ComandaDia {
  id: string;
  numero: string;
  hora: string;
  /** VALIDADO / TRASPASADA / PENDIENTE (pendiente = por cobrar). */
  estado: string;
  cliente: string | null;
  creadoPor: string | null;
  observaciones: string | null;
  pagos: PagoLinea[];
  items: Array<{
    nombre: string;
    cantidad: number;
    subtotal: number;
    trabajador: string | null;
  }>;
  total: Montos;
}

export interface SenaDia {
  id: string;
  hora: string;
  cliente: string | null;
  tipoPago: string;
  moneda: Moneda;
  monto: number;
  estado: string;
  observaciones: string | null;
  servicio: string | null;
  /** Día AR del turno reservado, si viene de una reserva. */
  turno: string | null;
}

export interface EgresoDia {
  id: string;
  hora: string;
  caja: string;
  moneda: Moneda;
  monto: number;
  numero: string;
  observaciones: string | null;
  creadoPor: string | null;
  conceptos: string[];
}

export interface MovimientosDia {
  dia: string;
  zona: string;
  generadoEn: string;
  comandas: ComandaDia[];
  senas: SenaDia[];
  egresos: EgresoDia[];
}

export interface FilaComanda {
  id: string;
  numero: string;
  hora: string;
  estado: string;
  cliente: string | null;
  creado_por: string | null;
  observaciones: string | null;
  precio_pesos: string | number | null;
  precio_dolar: string | number | null;
}
export interface FilaPago {
  comanda_id: string;
  tipo: string;
  moneda: string;
  monto: string | number;
}
export interface FilaItem {
  comanda_id: string;
  nombre: string;
  cantidad: number;
  subtotal: string | number | null;
  trabajador: string | null;
}
export interface FilaSena {
  id: string;
  hora: string;
  cliente: string | null;
  tipo_pago: string | null;
  moneda: string;
  monto: string | number;
  estado: string;
  observaciones: string | null;
  servicio: string | null;
  turno: string | null;
}
export interface FilaEgreso {
  id: string;
  hora: string;
  caja: string;
  moneda: string;
  monto: string | number | null;
  numero: string;
  observaciones: string | null;
  creado_por: string | null;
  comanda_id: string;
}

const num = (v: string | number | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const moneda = (m: string | null | undefined): Moneda =>
  String(m ?? '').toUpperCase() === 'USD' ? 'USD' : 'ARS';
const texto = (t: string | null | undefined) => {
  const s = (t ?? '').replace(/\s+/g, ' ').trim();
  return s || null;
};

/** Valida el día (AAAA-MM-DD, existente). */
export function validarDia(dia: string): void {
  diasDelRango(dia, dia);
}

export function armarMovimientos(
  dia: string,
  comandas: FilaComanda[],
  pagos: FilaPago[],
  items: FilaItem[],
  senas: FilaSena[],
  egresos: FilaEgreso[],
  itemsEgreso: FilaItem[],
  ahora = new Date(),
): MovimientosDia {
  const pagosDe = new Map<string, PagoLinea[]>();
  for (const p of pagos) {
    const list = pagosDe.get(p.comanda_id) ?? [];
    list.push({ tipo: p.tipo, moneda: moneda(p.moneda), monto: num(p.monto) });
    pagosDe.set(p.comanda_id, list);
  }
  const itemsDe = new Map<string, ComandaDia['items']>();
  for (const i of items) {
    const list = itemsDe.get(i.comanda_id) ?? [];
    list.push({
      nombre: texto(i.nombre) ?? 'Ítem',
      cantidad: Number(i.cantidad) || 1,
      subtotal: num(i.subtotal),
      trabajador: texto(i.trabajador),
    });
    itemsDe.set(i.comanda_id, list);
  }
  const conceptosDe = new Map<string, string[]>();
  for (const i of itemsEgreso) {
    const list = conceptosDe.get(i.comanda_id) ?? [];
    const n = texto(i.nombre);
    if (n) list.push(n);
    conceptosDe.set(i.comanda_id, list);
  }

  return {
    dia,
    zona: ZONA,
    generadoEn: ahora.toISOString(),
    comandas: comandas.map((c) => {
      let lineas = pagosDe.get(c.id) ?? [];
      if (!lineas.length) {
        // Sin líneas de pago: el precio de la comanda, como en los totales.
        lineas = [
          {
            tipo: 'SIN_DETALLE',
            moneda: 'ARS' as Moneda,
            monto: num(c.precio_pesos),
          },
          {
            tipo: 'SIN_DETALLE',
            moneda: 'USD' as Moneda,
            monto: num(c.precio_dolar),
          },
        ].filter((l) => l.monto !== 0);
      }
      const total: Montos = { ARS: 0, USD: 0 };
      for (const l of lineas) total[l.moneda] = num(total[l.moneda] + l.monto);
      return {
        id: c.id,
        numero: c.numero,
        hora: c.hora,
        estado: c.estado,
        cliente: texto(c.cliente),
        creadoPor: texto(c.creado_por),
        observaciones: texto(c.observaciones),
        pagos: lineas,
        items: itemsDe.get(c.id) ?? [],
        total,
      };
    }),
    senas: senas.map((s) => ({
      id: s.id,
      hora: s.hora,
      cliente: texto(s.cliente),
      tipoPago: s.tipo_pago ?? 'SIN_DETALLE',
      moneda: moneda(s.moneda),
      monto: num(s.monto),
      estado: s.estado,
      observaciones: texto(s.observaciones),
      servicio: texto(s.servicio),
      turno: s.turno,
    })),
    egresos: egresos.map((e) => ({
      id: e.id,
      hora: e.hora,
      caja: e.caja,
      moneda: moneda(e.moneda),
      monto: num(e.monto),
      numero: e.numero,
      observaciones: texto(e.observaciones),
      creadoPor: texto(e.creado_por),
      conceptos: conceptosDe.get(e.comanda_id) ?? [],
    })),
  };
}
