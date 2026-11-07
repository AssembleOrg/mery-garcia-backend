import { EstadoPedidoCompra as E } from './entities/PedidoCompra.entity';

/** Una vez comprado, el pedido se puede corregir durante este tiempo. */
export const HORAS_EDICION = 48;
const VENTANA_MS = HORAS_EDICION * 60 * 60 * 1000;

/** Hasta cuándo se puede editar. Null = todavía no se compró (sin límite). */
export function editableHasta(compradoAt: Date | null): Date | null {
  return compradoAt ? new Date(compradoAt.getTime() + VENTANA_MS) : null;
}

/** Pasaron las 48 h desde que se marcó comprado. */
export function bloqueado(
  compradoAt: Date | null,
  ahora = new Date(),
): boolean {
  const hasta = editableHasta(compradoAt);
  return hasta !== null && ahora.getTime() > hasta.getTime();
}

export const MENSAJE_BLOQUEADO = `Pasaron más de ${HORAS_EDICION} h desde que se compró: ya no se puede editar.`;

export interface DatosPedido {
  titulo: string | null;
  nota: string | null;
  proveedores: number;
  items: number;
}

/** Qué le falta al pedido para quedar en ese estado. Null = está bien. */
export function faltaPara(estado: E, d: DatosPedido): string | null {
  const conTexto = !!d.titulo?.trim() || !!d.nota?.trim();
  if (d.items === 0 && !conTexto)
    return 'Cargá al menos un artículo o una nota.';
  if (estado === E.COMPRADO || estado === E.ENTREGADO) {
    if (d.items === 0)
      return 'Para marcarlo comprado tiene que tener artículos.';
    if (d.proveedores === 0)
      return 'Para marcarlo comprado elegí al menos un proveedor.';
  }
  return null;
}

/**
 * Fechas que quedan al pasar a `nuevo`. Comprar fija `compradoAt` (desde ahí
 * corren las 48 h); volver a Anotado o Pedir precio lo borra.
 */
export function fechasPara(
  nuevo: E,
  actual: { compradoAt: Date | null; entregadoAt: Date | null },
  ahora = new Date(),
): { compradoAt: Date | null; entregadoAt: Date | null } {
  switch (nuevo) {
    case E.ANOTADO:
    case E.PEDIR_PRECIO:
      return { compradoAt: null, entregadoAt: null };
    case E.COMPRADO:
      return { compradoAt: actual.compradoAt ?? ahora, entregadoAt: null };
    case E.ENTREGADO:
      return {
        compradoAt: actual.compradoAt ?? ahora,
        entregadoAt: actual.entregadoAt ?? ahora,
      };
    case E.CANCELADO:
      return { compradoAt: actual.compradoAt, entregadoAt: null };
  }
}

/** Suma de cantidad × precio. Null si ningún renglón tiene precio. */
export function totalCalculado(
  items: { cantidad: number; precioUnitario: number | null }[],
): number | null {
  const conPrecio = items.filter((i) => i.precioUnitario !== null);
  if (!conPrecio.length) return null;
  const centavos = conPrecio.reduce(
    (s, i) => s + Math.round(i.cantidad * (i.precioUnitario as number) * 100),
    0,
  );
  return centavos / 100;
}

/** "  Hisopos   largos " → "Hisopos largos". */
export function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/** Para comparar nombres sin importar mayúsculas ni tildes. */
export function claveNombre(nombre: string): string {
  return limpiarNombre(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
