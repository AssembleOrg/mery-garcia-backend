/**
 * Fechas de calendario en la zona de la empresa. Se trabaja con strings
 * YYYY-MM-DD y no con Date para que un cambio de huso no corra un turno de día.
 */

export const TZ_EMPRESA = 'America/Argentina/Buenos_Aires';

/** Hoy en la zona de la empresa, como YYYY-MM-DD. */
export function hoyEnEmpresa(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_EMPRESA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Mediodía UTC: lejos de cualquier borde de día, sumar días nunca se pasa. */
function comoFecha(dia: string): Date {
  return new Date(`${dia}T12:00:00Z`);
}

export function sumarDias(dia: string, cantidad: number): string {
  const d = comoFecha(dia);
  d.setUTCDate(d.getUTCDate() + cantidad);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo. */
export function diaIso(dia: string): number {
  const js = comoFecha(dia).getUTCDay();
  return js === 0 ? 7 : js;
}

export function lunesDeLaSemana(dia: string): string {
  return sumarDias(dia, -(diaIso(dia) - 1));
}

/** Lunes de la semana que viene: lo que genera el cron del domingo. */
export function lunesDeLaSemanaQueViene(ahora: Date = new Date()): string {
  return sumarDias(lunesDeLaSemana(hoyEnEmpresa(ahora)), 7);
}

export function diferenciaEnSemanas(desde: string, hasta: string): number {
  const dias =
    (comoFecha(hasta).getTime() - comoFecha(desde).getTime()) / 86_400_000;
  return Math.round(dias / 7);
}

/** "HH:MM" → minutos desde la medianoche. */
export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
