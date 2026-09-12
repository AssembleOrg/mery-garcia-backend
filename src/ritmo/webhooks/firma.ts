import { createHmac, timingSafeEqual } from 'node:crypto';

/** Fuera de esta ventana la entrega se descarta: frena reenvíos grabados. */
export const TOLERANCIA_SEGUNDOS = 300;

/**
 * Verifica la cabecera `X-Ritmo-Signature: t=<unix>,v1=<hex>`, donde
 * `v1 = HMAC-SHA256(secreto, "<t>.<cuerpo crudo>")`.
 *
 * El cuerpo tiene que ser el crudo, byte por byte: si se parsea y se vuelve a
 * serializar, cualquier diferencia de espacios o de orden de claves cambia el
 * HMAC y toda entrega legítima se rechaza.
 */
export function verificarFirmaRitmo(
  secreto: string,
  cabecera: string | undefined,
  cuerpoCrudo: string,
  ahora: Date = new Date(),
): boolean {
  if (!secreto || !cabecera) return false;

  const partes = new Map(
    cabecera.split(',').map((parte) => {
      const i = parte.indexOf('=');
      return i === -1
        ? ([parte.trim(), ''] as const)
        : ([parte.slice(0, i).trim(), parte.slice(i + 1).trim()] as const);
    }),
  );

  const t = partes.get('t');
  const v1 = partes.get('v1');
  if (!t || !v1 || !/^\d+$/.test(t) || !/^[0-9a-f]{64}$/.test(v1)) return false;

  const desfase = Math.abs(Math.floor(ahora.getTime() / 1000) - Number(t));
  if (desfase > TOLERANCIA_SEGUNDOS) return false;

  const esperado = createHmac('sha256', secreto)
    .update(`${t}.${cuerpoCrudo}`)
    .digest('hex');

  // Longitudes iguales por el regex de arriba, así que timingSafeEqual no tira.
  return timingSafeEqual(Buffer.from(esperado, 'hex'), Buffer.from(v1, 'hex'));
}
