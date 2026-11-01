/**
 * Registro de productos desde Ritmo: las chicas anotan qué agarraron
 * (shampoo, cremas, hisopos) y eso queda como solicitud de stock. Acá va lo
 * que no toca la base: validar lo que manda Ritmo, buscar en el catálogo,
 * los textos del aviso y qué hacer con un voto de la encuesta.
 */
import { EstadoSolicitudStock } from './entities/SolicitudStock.entity';
import { TZ_EMPRESA } from '../ritmo/turnos/fechas';

export const MAX_ITEMS = 20;
export const MAX_CANTIDAD = 20;
export const MAX_NOTA = 300;
export const MAX_NOMBRE = 150;
export const MAX_RESULTADOS = 20;

export const OPCION_CONFIRMAR = '✅ Confirmar';
export const OPCION_ANULAR = '❌ Anular';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ItemPedido {
  productoId: string | null;
  nombre: string;
  cantidad: number;
}

export type PedidoRitmo =
  | {
      accion: 'crear';
      userId: string;
      items: ItemPedido[];
      nota: string | null;
    }
  | { accion: 'cancelar'; userId: string; registroId: string };

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Lo que manda Ritmo en el POST, ya validado. Tira Error con el motivo. */
export function validarPedidoRitmo(body: unknown): PedidoRitmo {
  if (!body || typeof body !== 'object')
    throw new Error('Falta el cuerpo del pedido.');
  const b = body as Record<string, unknown>;
  const userId = texto(b.userId);
  if (!UUID.test(userId)) throw new Error('Falta userId.');

  if (b.action === 'cancel') {
    const registroId = texto(b.recordId);
    if (!UUID.test(registroId)) throw new Error('Falta recordId.');
    return { accion: 'cancelar', userId, registroId };
  }
  if (b.action !== 'create')
    throw new Error('action tiene que ser "create" o "cancel".');

  if (!Array.isArray(b.items) || b.items.length === 0)
    throw new Error('Elegí al menos un producto.');
  if (b.items.length > MAX_ITEMS)
    throw new Error(`Como mucho ${MAX_ITEMS} productos por vez.`);

  const items: ItemPedido[] = b.items.map((crudo: unknown) => {
    const i = (crudo ?? {}) as Record<string, unknown>;
    const nombre = texto(i.name);
    if (!nombre) throw new Error('Hay un producto sin nombre.');
    if (nombre.length > MAX_NOMBRE)
      throw new Error(`El nombre "${nombre.slice(0, 30)}…" es muy largo.`);
    const productoId =
      i.productId === null || i.productId === undefined || i.productId === ''
        ? null
        : texto(i.productId);
    if (productoId !== null && !UUID.test(productoId))
      throw new Error('productId no es válido.');
    const cantidad = i.quantity === undefined ? 1 : Number(i.quantity);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD)
      throw new Error(`La cantidad va de 1 a ${MAX_CANTIDAD}.`);
    return { productoId, nombre, cantidad };
  });

  const nota = texto(b.note);
  if (nota.length > MAX_NOTA)
    throw new Error(`La nota puede tener hasta ${MAX_NOTA} letras.`);
  return {
    accion: 'crear',
    userId,
    items: juntarIguales(items),
    nota: nota || null,
  };
}

/** El mismo producto (o el mismo texto libre) dos veces se suma en uno. */
export function juntarIguales(items: ItemPedido[]): ItemPedido[] {
  const porClave = new Map<string, ItemPedido>();
  for (const it of items) {
    const clave = it.productoId ?? `libre:${plegar(it.nombre)}`;
    const previo = porClave.get(clave);
    if (previo)
      previo.cantidad = Math.min(MAX_CANTIDAD, previo.cantidad + it.cantidad);
    else porClave.set(clave, { ...it });
  }
  return [...porClave.values()];
}

/** Sin tildes ni mayúsculas, para buscar "acido" y encontrar "Ácido". */
export const plegar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Busca en el catálogo: todas las palabras tienen que estar; primero los que
 * empiezan con lo buscado, después el resto, por nombre.
 */
export function buscarEnCatalogo<T extends { nombre: string }>(
  catalogo: T[],
  q: string,
  max = MAX_RESULTADOS,
): T[] {
  const buscado = plegar(q);
  if (!buscado) return [];
  const palabras = buscado.split(' ');
  return catalogo
    .map((p) => ({ p, n: plegar(p.nombre) }))
    .filter(({ n }) => palabras.every((w) => n.includes(w)))
    .sort(
      (a, b) =>
        Number(!a.n.startsWith(buscado)) - Number(!b.n.startsWith(buscado)) ||
        a.n.localeCompare(b.n),
    )
    .slice(0, max)
    .map(({ p }) => p);
}

/** "15:42" en la hora del salón. */
export function horaSalon(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ_EMPRESA,
  }).format(d);
}

export type EstadoRitmo = 'PENDING' | 'CONFIRMED' | 'VOIDED' | 'CANCELLED';

export const ESTADO_RITMO: Record<EstadoSolicitudStock, EstadoRitmo> = {
  [EstadoSolicitudStock.PENDIENTE]: 'PENDING',
  [EstadoSolicitudStock.APROBADA]: 'CONFIRMED',
  [EstadoSolicitudStock.RECHAZADA]: 'VOIDED',
  [EstadoSolicitudStock.CANCELADA]: 'CANCELLED',
};

/** Lo que lee ella en Ritmo al lado de cada registro. */
export function etiquetaEstado(
  estado: EstadoSolicitudStock,
  creada: Date,
  autoconfirmaMin: number,
): string {
  switch (estado) {
    case EstadoSolicitudStock.PENDIENTE:
      return `Se confirma sola a las ${horaSalon(
        new Date(creada.getTime() + autoconfirmaMin * 60_000),
      )}`;
    case EstadoSolicitudStock.APROBADA:
      return 'Confirmado';
    case EstadoSolicitudStock.RECHAZADA:
      return 'Anulado';
    case EstadoSolicitudStock.CANCELADA:
      return 'Cancelado por vos';
  }
}

/** "1 Shampoo neutro, 3 Hisopos (libre)". */
export function listaItems(
  items: { nombre: string; cantidad: number; libre?: boolean }[],
): string {
  return items
    .map((i) => `${i.cantidad} ${i.nombre}${i.libre ? ' (libre)' : ''}`)
    .join(', ');
}

/**
 * El título de la encuesta que va al grupo: quién, qué, a qué hora y la
 * nota. Es lo único que se manda, así que tiene que alcanzar para decidir.
 * WhatsApp corta en 255.
 */
export function tituloEncuesta(input: {
  nombre: string;
  items: { nombre: string; cantidad: number; libre?: boolean }[];
  nota: string | null;
  creada: Date;
}): string {
  const base = `🧴 ${input.nombre} anotó: ${listaItems(input.items)} · ${horaSalon(input.creada)}`;
  const conNota = input.nota ? `${base}\n📝 ${input.nota}` : base;
  return conNota.length <= 255 ? conNota : `${conNota.slice(0, 254)}…`;
}

/**
 * Qué quiere decir un voto: confirmar, anular o nada (sacó el voto, o eligió
 * algo que no es ninguna de las dos).
 */
export function decisionDelVoto(
  elegidas: string[],
): EstadoSolicitudStock.APROBADA | EstadoSolicitudStock.RECHAZADA | null {
  const anula = elegidas.includes(OPCION_ANULAR);
  const confirma = elegidas.includes(OPCION_CONFIRMAR);
  if (anula === confirma) return null;
  return anula ? EstadoSolicitudStock.RECHAZADA : EstadoSolicitudStock.APROBADA;
}

/** El teléfono vota si está en la lista (comparando los últimos 10 dígitos). */
export function votanteAutorizado(
  telefono: string,
  votantes: string[],
): boolean {
  const t = telefono.replace(/\D/g, '');
  if (t.length < 8) return false;
  const cola = (x: string) => x.slice(-10);
  return votantes.some((v) => cola(v) === cola(t));
}
