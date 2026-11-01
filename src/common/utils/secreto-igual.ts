import { timingSafeEqual } from 'node:crypto';

/** Compara un secreto compartido en tiempo constante. Vacío nunca es igual. */
export function secretoIgual(
  esperado: string | undefined,
  dado: string | undefined,
): boolean {
  if (!esperado || !dado) return false;
  const a = Buffer.from(dado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
