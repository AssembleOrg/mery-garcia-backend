import { DateTime } from 'luxon';
import type { HorarioAtencion } from './entities/WhatsappConfig.entity';

export const TZ_LOCAL = 'America/Argentina/Buenos_Aires';

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

/** ¿El local está abierto ahora? Las personas atienden sólo en este horario. */
export function estaAbierto(horario: HorarioAtencion, ahora = new Date()): boolean {
  const local = DateTime.fromJSDate(ahora, { zone: TZ_LOCAL });
  if (!horario.dias.includes(local.weekday)) return false;
  const minuto = local.hour * 60 + local.minute;
  return minuto >= aMinutos(horario.desde) && minuto < aMinutos(horario.hasta);
}

/** "lunes a sábado de 10:00 a 19:00" para meter en el mensaje de fuera de horario. */
export function describirHorario(horario: HorarioAtencion): string {
  const dias = [...horario.dias].sort((a, b) => a - b);
  if (dias.length === 0) return `de ${horario.desde} a ${horario.hasta}`;
  const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  const textoDias =
    dias.length === 1
      ? `los ${DIAS[dias[0]]}`
      : consecutivos
        ? `${DIAS[dias[0]]} a ${DIAS[dias[dias.length - 1]]}`
        : dias.map((d) => DIAS[d]).join(', ');
  return `${textoDias} de ${horario.desde} a ${horario.hasta}`;
}

export function horarioValido(h: unknown): h is HorarioAtencion {
  if (!h || typeof h !== 'object') return false;
  const { dias, desde, hasta } = h as Record<string, unknown>;
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  return (
    Array.isArray(dias) &&
    dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) &&
    typeof desde === 'string' &&
    typeof hasta === 'string' &&
    hhmm.test(desde) &&
    hhmm.test(hasta) &&
    aMinutos(desde) < aMinutos(hasta)
  );
}
