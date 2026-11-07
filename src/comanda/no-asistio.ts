/**
 * Comanda de una clienta que no se presentó: se pierde la seña. La comanda
 * solo lleva el servicio (y quién lo iba a hacer) y la seña que se consume; no
 * lleva pagos, descuentos ni productos. La comisión del servicio se calcula
 * sobre la seña, con el porcentaje que le corresponde a ese servicio.
 */

export const NO_ASISTIO_SIN_SENA =
  'Para marcar "No se presentó" hay que consumir la seña de la clienta.';
export const NO_ASISTIO_SIN_CLIENTE =
  'Para marcar "No se presentó" hay que elegir la clienta.';
export const NO_ASISTIO_SOLO_INGRESO =
  '"No se presentó" solo va en comandas de ingreso.';
export const NO_ASISTIO_SIN_SERVICIO =
  'Cargá el servicio y quién lo iba a hacer: la comisión se calcula sobre la seña.';
export const NO_ASISTIO_SIN_PAGOS =
  'Una comanda de "No se presentó" no lleva pagos: solo se consume la seña.';
export const NO_ASISTIO_SOLO_SERVICIOS =
  'Una comanda de "No se presentó" solo lleva servicios, no productos.';

export interface NoAsistioInput {
  esIngreso: boolean;
  clienteId?: string | null;
  consumeSeñaARS: boolean;
  consumeSeñaUSD: boolean;
  items: Array<{ trabajadorId?: string | null; esProducto: boolean }>;
  /** Montos de los pagos que vinieron en el pedido (comanda e ítems). */
  pagos: number[];
}

/** El primer problema que impide guardar la comanda como "No se presentó", o null. */
export function problemaNoAsistio(c: NoAsistioInput): string | null {
  if (!c.esIngreso) return NO_ASISTIO_SOLO_INGRESO;
  if (!c.clienteId) return NO_ASISTIO_SIN_CLIENTE;
  if (!c.consumeSeñaARS && !c.consumeSeñaUSD) return NO_ASISTIO_SIN_SENA;
  if (c.items.some((i) => i.esProducto)) return NO_ASISTIO_SOLO_SERVICIOS;
  if (!c.items.some((i) => !!i.trabajadorId)) return NO_ASISTIO_SIN_SERVICIO;
  if (c.pagos.some((m) => Number(m) > 0)) return NO_ASISTIO_SIN_PAGOS;
  return null;
}

export interface ServicioNoAsistio {
  trabajadorId: string;
  servicio: string;
  /** Precio del servicio: reparte la seña si la comanda tiene más de uno. */
  subtotal: number;
}

export interface ParteNoAsistio {
  trabajadorId: string;
  servicio: string;
  moneda: 'ARS' | 'USD';
  /** Parte de la seña que le toca a este servicio. */
  seña: number;
}

/**
 * Reparte la seña de cada moneda entre los servicios de la comanda, en
 * proporción a su precio (si ninguno tiene precio, en partes iguales). Con un
 * solo servicio, toda la seña es suya.
 */
export function repartirSeña(
  seña: { ARS: number; USD: number },
  servicios: ServicioNoAsistio[],
): ParteNoAsistio[] {
  if (!servicios.length) return [];
  const total = servicios.reduce((a, s) => a + Math.max(0, s.subtotal), 0);
  const peso = (s: ServicioNoAsistio) =>
    total > 0 ? Math.max(0, s.subtotal) / total : 1 / servicios.length;
  const out: ParteNoAsistio[] = [];
  for (const moneda of ['ARS', 'USD'] as const) {
    const monto = Number(seña[moneda] ?? 0);
    if (!(monto > 0)) continue;
    let resto = monto;
    servicios.forEach((s, i) => {
      // El último se lleva el redondeo: la suma da exacto la seña.
      const parte =
        i === servicios.length - 1
          ? Math.round(resto * 100) / 100
          : Math.round(monto * peso(s) * 100) / 100;
      resto -= parte;
      out.push({
        trabajadorId: s.trabajadorId,
        servicio: s.servicio,
        moneda,
        seña: parte,
      });
    });
  }
  return out;
}

export const comisionSobreSeña = (seña: number, porcentaje: number): number =>
  Math.round(((seña * porcentaje) / 100) * 100) / 100;
