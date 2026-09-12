/**
 * Teléfonos argentinos en todas sus variantes.
 *
 * El mismo celular llega como +54 9 11 3658-5581 por WhatsApp, y en el ERP
 * puede estar cargado como 1536585581, 011 15 3658 5581, 11-3658-5581 o
 * 5491136585581. Para cruzarlos se reduce todo a los últimos 8 dígitos del
 * número local (lo que sobrevive a cualquier prefijo: 0, 54, 9, 15, área).
 */

export function soloDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Saca prefijo internacional, el 9 de celular, el 0 de larga distancia y el 15. */
export function numeroLocal(valor: string | null | undefined): string {
  let d = soloDigitos(valor);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54') && d.length > 10) d = d.slice(2);
  if (d.startsWith('9') && d.length > 10) d = d.slice(1);
  if (d.startsWith('0') && d.length > 8) d = d.slice(1);
  // 15 después del área: 11 15 xxxx xxxx (12 dígitos) o sin área 15 xxxx xxxx.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  } else if (d.length === 10 && d.startsWith('15')) {
    d = d.slice(2);
  }
  return d;
}

/** Los 8 dígitos finales del número local: la clave para cruzar con el ERP. */
export function sufijoTelefono(valor: string | null | undefined): string | null {
  const local = numeroLocal(valor);
  if (local.length < 8) return null;
  return local.slice(-8);
}

/** "5491136585581" → "+54 9 11 3658-5581". Otros países: +cc y el resto. */
export function formatearTelefono(e164: string | null | undefined): string | null {
  const d = soloDigitos(e164);
  if (!d) return null;
  if (d.startsWith('549') && d.length >= 12) {
    const resto = d.slice(3);
    // Sólo el 11 (AMBA) tiene área de 2 dígitos; el resto del país usa 3 o 4.
    // Sin tabla de áreas, 3 es lo más común: el agrupado es visual nomás.
    const largoArea = resto.startsWith('11') ? 2 : resto.length - 8 >= 3 ? 3 : Math.max(2, resto.length - 8);
    const area = resto.slice(0, largoArea);
    const num = resto.slice(area.length);
    if (num.length === 8) return `+54 9 ${area} ${num.slice(0, 4)}-${num.slice(4)}`;
    if (num.length === 7) return `+54 9 ${area} ${num.slice(0, 3)}-${num.slice(3)}`;
    if (num.length === 6) return `+54 9 ${area} ${num.slice(0, 2)}-${num.slice(2)}`;
    return `+54 9 ${area} ${num}`;
  }
  if (d.startsWith('54')) {
    const resto = d.slice(2);
    return `+54 ${resto}`;
  }
  return `+${d}`;
}
