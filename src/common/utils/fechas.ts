/**
 * Formatos de fecha para mostrar (PDFs, notas): siempre dd/mm/aaaa, como en
 * el resto del sistema.
 */

const TZ_AR = 'America/Argentina/Buenos_Aires';

/** "2026-09-15" (o un ISO completo) → "15/09/2026", sin pasar por zonas horarias. */
export function fechaDMY(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dia;
}

/** Fecha y hora de Argentina: "15/09/2026 14:05" (24 h). Con `segundos`, "14:05:09". */
export function fechaHoraAR(fecha: Date = new Date(), segundos = false, timeZone = TZ_AR): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(segundos ? { second: '2-digit' as const } : {}),
    hour12: false,
  })
    .format(fecha)
    .replace(',', '');
}

/** Solo la fecha de Argentina: "15/09/2026". */
export function fechaAR(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ_AR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}
