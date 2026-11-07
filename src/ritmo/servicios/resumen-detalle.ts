/**
 * La parte del resumen de Ritmo que dice qué se hizo, uno por uno, y cuánto
 * se ganó ese día. Sale del cálculo de comisiones (el mismo de la pantalla de
 * Comisiones), así los números coinciden.
 *
 * Por ahora Ritmo no muestra plata (pedido de Charly 07/11): va
 * `armarListado` (qué servicio, de qué categoría, cuántos y en qué
 * comandas). `armarSecciones`/`armarGanancia` quedan para cuando se vuelva a
 * mostrar: la plata solo con esquema por base fija.
 */
import type { LineaComision } from 'src/comanda/comisiones/detalle';

export type Moneda = 'ARS' | 'USD';

export interface Monto {
  currency: Moneda;
  value: number;
}

/** Contrato `earnings` de Ritmo: la plata del día, arriba de todo. */
export interface GananciaDia {
  label: string;
  amounts: Monto[];
  detail: string | null;
}

/** Contrato `sections` de Ritmo: listados con un renglón por cosa hecha. */
export interface RenglonDia {
  key: string;
  label: string;
  detail: string | null;
  badge: string | null;
  tone: 'default' | 'muted' | 'warning';
  amount: Monto | null;
  amountDetail: string | null;
}

export interface SeccionDia {
  key: string;
  title: string;
  lines: RenglonDia[];
}

export interface ComisionDelDia {
  totalARS: number;
  totalUSD: number;
  /** Al máximo del rango si el % del mes no está confirmado (solo ARS). */
  totalARSAlMaximo: number | null;
  porcentajePendiente: boolean;
  detalle: LineaComision[];
}

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const dolares = (n: number) =>
  `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const plata = (n: number, moneda: Moneda) =>
  moneda === 'USD' ? dolares(n) : pesos(n);
const pct = (n: number) =>
  `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;

const conCantidad = (l: LineaComision) =>
  l.cantidad > 1 ? `${l.item} ×${l.cantidad}` : l.item;
const detalleDe = (...partes: Array<string | null | undefined>) =>
  partes.filter((p) => p && p.trim()).join(' · ') || null;

function renglon(l: LineaComision, i: number, conPlata: boolean): RenglonDia {
  const noAsistio = l.tipo === 'NO_ASISTIO';
  const calculo = noAsistio
    ? `seña ${plata(l.base, l.moneda)} × ${pct(l.porcentaje)}`
    : l.nota
      ? l.nota
      : `${plata(l.base, l.moneda)} × ${pct(l.porcentaje)}`;
  return {
    key: `${l.comandaId}-${l.tipo}-${i}`,
    label: conCantidad(l),
    detail: detalleDe(noAsistio ? null : l.categoria, l.cliente, l.hora),
    badge: noAsistio ? 'No se presentó' : l.validada ? null : 'sin validar',
    tone: noAsistio ? 'warning' : l.tipo === 'PRODUCTO' ? 'muted' : 'default',
    amount:
      conPlata && !l.nota ? { currency: l.moneda, value: l.comision } : null,
    amountDetail: conPlata || l.nota ? calculo : null,
  };
}

/**
 * Listados del día: servicios hechos, clientas que no vinieron y productos,
 * cada uno por hora. Secciones vacías no van.
 */
export function armarSecciones(
  detalle: LineaComision[],
  conPlata: boolean,
): SeccionDia[] {
  const orden = [...detalle].sort(
    (a, b) => a.hora.localeCompare(b.hora) || a.numero.localeCompare(b.numero),
  );
  const de = (tipo: LineaComision['tipo']) =>
    orden.filter((l) => l.tipo === tipo).map((l, i) => renglon(l, i, conPlata));
  const secciones: SeccionDia[] = [
    { key: 'servicios', title: 'Servicios', lines: de('SERVICIO') },
    { key: 'no-asistio', title: 'No se presentaron', lines: de('NO_ASISTIO') },
    { key: 'productos', title: 'Productos', lines: de('PRODUCTO') },
  ];
  return secciones.filter((s) => s.lines.length > 0);
}

/**
 * "Tu comisión del día": el total en cada moneda y cómo se calculó. Si el %
 * del mes todavía no se confirmó, va al mínimo y se dice hasta cuánto daría.
 */
export function armarGanancia(c: ComisionDelDia): GananciaDia {
  const amounts: Monto[] = [
    { currency: 'ARS', value: Math.round(c.totalARS * 100) / 100 },
  ];
  if (c.totalUSD > 0)
    amounts.push({
      currency: 'USD',
      value: Math.round(c.totalUSD * 100) / 100,
    });
  const porcentajes = [
    ...new Set(
      c.detalle
        .filter((l) => l.esquemaBase && l.tipo !== 'PRODUCTO' && !l.nota)
        .map((l) => l.porcentaje),
    ),
  ];
  let detail: string | null = null;
  if (
    c.porcentajePendiente &&
    c.totalARSAlMaximo != null &&
    c.totalARSAlMaximo > c.totalARS
  ) {
    detail = `Calculada al ${porcentajes.map(pct).join(' / ') || 'mínimo'}: el % del mes se confirma al cierre. Al máximo serían ${pesos(c.totalARSAlMaximo)}.`;
  } else if (porcentajes.length) {
    detail = `Al ${porcentajes.map(pct).join(' / ')}. Incluye lo que todavía no está validado en caja.`;
  }
  return { label: 'Tu comisión del día', amounts, detail };
}

/** Tope de Ritmo para `detail` (140): si hay muchas comandas, "+3 más". */
const MAX_DETALLE = 140;

/** "Categoría A · Comandas 01-11302 · 01-11305", recortado si no entra. */
export function detalleComandas(
  categoria: string | null,
  numeros: string[],
): string {
  const prefijo = [categoria, numeros.length === 1 ? 'Comanda' : 'Comandas']
    .filter(Boolean)
    .join(' · ');
  for (let n = numeros.length; n >= 1; n--) {
    const resto = numeros.length - n;
    const texto = `${prefijo} ${numeros.slice(0, n).join(' · ')}${resto ? ` (+${resto} más)` : ''}`;
    if (texto.length <= MAX_DETALLE) return texto;
  }
  return `${prefijo} ${numeros.length}`.slice(0, MAX_DETALLE);
}

const ordenComanda = (a: string, b: string) =>
  a.localeCompare(b, 'es', { numeric: true });

/**
 * Listado sin plata: un renglón por servicio (con cuántos hizo), su
 * categoría y en qué comandas está. Las clientas que no se presentaron van
 * aparte. Los productos no van (no son servicios).
 */
export function armarListado(detalle: LineaComision[]): SeccionDia[] {
  const agrupar = (tipo: LineaComision['tipo']): RenglonDia[] => {
    const grupos = new Map<
      string,
      {
        item: string;
        categoria: string | null;
        cantidad: number;
        comandas: Set<string>;
        sinValidar: Set<string>;
      }
    >();
    for (const l of detalle.filter((x) => x.tipo === tipo)) {
      const clave = `${l.categoria ?? ''}|${l.item}`;
      const g = grupos.get(clave) ?? {
        item: l.item,
        categoria: l.categoria,
        cantidad: 0,
        comandas: new Set(),
        sinValidar: new Set(),
      };
      g.cantidad += l.cantidad;
      g.comandas.add(l.numero);
      if (!l.validada) g.sinValidar.add(l.numero);
      grupos.set(clave, g);
    }
    return [...grupos.values()]
      .sort(
        (a, b) =>
          (a.categoria ?? '\uffff').localeCompare(
            b.categoria ?? '\uffff',
            'es',
          ) || a.item.localeCompare(b.item, 'es'),
      )
      .map((g, i) => {
        const comandas = [...g.comandas].sort(ordenComanda);
        const noAsistio = tipo === 'NO_ASISTIO';
        const sinValidar = g.sinValidar.size;
        return {
          key: `${tipo}-${i}-${g.item}`.slice(0, 80),
          label: g.cantidad > 1 ? `${g.item} ×${g.cantidad}` : g.item,
          detail: detalleComandas(g.categoria, comandas),
          badge: noAsistio
            ? 'No se presentó'
            : sinValidar === 0
              ? null
              : sinValidar === comandas.length
                ? 'sin validar'
                : `${sinValidar} sin validar`,
          tone: noAsistio ? 'warning' : 'default',
          amount: null,
          amountDetail: null,
        };
      });
  };
  const secciones: SeccionDia[] = [
    { key: 'servicios', title: 'Servicios', lines: agrupar('SERVICIO') },
    {
      key: 'no-asistio',
      title: 'No se presentaron',
      lines: agrupar('NO_ASISTIO'),
    },
  ];
  return secciones.filter((x) => x.lines.length > 0);
}
