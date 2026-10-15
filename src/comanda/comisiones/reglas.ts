/**
 * Reglas de comisión "por base fija" (desde octubre 2026).
 *
 * Para las trabajadoras que tienen bases cargadas, la comisión de un servicio
 * NO sale del precio cobrado: sale de un monto base fijo por categoría
 * (A, B, C, consultas...) que depende de cada trabajadora. Ej.: Luna cobra el
 * porcentaje sobre $45.000 por cada servicio de Categoría A, Rosario sobre
 * $40.000, cobre lo que cobre la clienta.
 *
 * El porcentaje es un rango (Luna 30–35%, Rosario 25–30%) que se confirma al
 * cierre de cada mes; mientras no se confirma se usa el mínimo y se informa
 * también el cálculo al máximo.
 *
 * Los productos van aparte: un porcentaje (5%) sobre el precio EN EFECTIVO.
 * Si se vendió la variante "precio lista"/"TARJETA", se toma el precio de su
 * gemela "efectivo" del catálogo.
 */

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  precioFijoARS?: number | null;
  esPrecioCongelado?: boolean;
  unidadNegocioId?: string | null;
}

// El orden importa: primero las frases largas ("efect y transf") y después
// las cortas ("efect"), si no queda basura en el nombre normalizado.
const TOKENS_PRECIO = [
  /\bprecio de lista\b/g,
  /\bprecio lista\b/g,
  /\befect(?:ivo)? y transf\b/g,
  /\befec y transf\b/g,
  /\befectivo\b/g,
  /\befect\b/g,
  /\befec\b/g,
  /\btarjeta\b/g,
];

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Nombre sin la variante de precio: "TINTES brow daddy precio lista DB" → "tintes brow daddy db". */
export function nombreBase(nombre: string): string {
  let s = sinAcentos(nombre.toLowerCase());
  for (const t of TOKENS_PRECIO) s = s.replace(t, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** ¿Es la variante "precio lista" / "TARJETA" (no la de efectivo)? */
export function esVarianteLista(nombre: string): boolean {
  const s = sinAcentos(nombre.toLowerCase());
  return /\bprecio (?:de )?lista\b|\btarjeta\b/.test(s);
}

const esVarianteEfectivo = (nombre: string): boolean => {
  const s = sinAcentos(nombre.toLowerCase());
  return /\befectivo\b|\befect\b|\befec\b/.test(s) && !esVarianteLista(nombre);
};

/** Precio de referencia en la misma unidad en que se compara (fijo ARS si está congelado). */
const precioReferencia = (p: ProductoCatalogo): number => {
  const fijo = Number(p.precioFijoARS ?? 0);
  if (p.esPrecioCongelado && fijo > 0) return fijo;
  return Number(p.precio ?? 0);
};

/**
 * Factor para llevar el monto vendido al precio en efectivo: 1 si ya es la
 * variante efectivo o no tiene gemela; si es "precio lista", efectivo/lista.
 * Se compara con la gemela de la misma unidad y del mismo tipo de precio
 * (los dos congelados en ARS o los dos de lista en USD); si no son
 * comparables, no se ajusta.
 */
export function factorEfectivo(producto: ProductoCatalogo, catalogo: ProductoCatalogo[]): number {
  if (!esVarianteLista(producto.nombre)) return 1;
  const base = nombreBase(producto.nombre);
  const gemela = catalogo.find(
    (p) =>
      p.id !== producto.id &&
      p.tipo === producto.tipo &&
      (producto.unidadNegocioId == null || p.unidadNegocioId === producto.unidadNegocioId) &&
      esVarianteEfectivo(p.nombre) &&
      nombreBase(p.nombre) === base,
  );
  if (!gemela) return 1;
  const congeladoA = !!producto.esPrecioCongelado && Number(producto.precioFijoARS ?? 0) > 0;
  const congeladoB = !!gemela.esPrecioCongelado && Number(gemela.precioFijoARS ?? 0) > 0;
  if (congeladoA !== congeladoB) return 1;
  const lista = precioReferencia(producto);
  const efectivo = precioReferencia(gemela);
  if (!(lista > 0) || !(efectivo > 0) || efectivo >= lista) return 1;
  return efectivo / lista;
}

export interface EsquemaTrabajadora {
  /** Porcentaje mínimo del rango (o el único, si no hay rango). */
  porcentajeMin: number;
  /** Porcentaje máximo del rango; null = sin rango. */
  porcentajeMax: number | null;
  /** Porcentaje de productos (5). */
  productosPorcentaje: number;
  /** Desde qué día (YYYY-MM-DD) rige el esquema por base fija. */
  desde: string;
  /** categoriaId → monto base en ARS. */
  bases: Map<string, number>;
  /** "YYYY-MM" → porcentaje confirmado al cierre. */
  confirmados: Map<string, number>;
}

/** Porcentaje a aplicar en un mes: el confirmado o, si no hay, el mínimo. */
export function porcentajeDelMes(esq: EsquemaTrabajadora, mes: string): { aplicado: number; maximo: number; confirmado: boolean } {
  const conf = esq.confirmados.get(mes);
  if (conf != null) return { aplicado: conf, maximo: conf, confirmado: true };
  return { aplicado: esq.porcentajeMin, maximo: esq.porcentajeMax ?? esq.porcentajeMin, confirmado: false };
}

export const redondear = (n: number) => Math.round(n * 100) / 100;
