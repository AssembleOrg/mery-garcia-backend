/**
 * Cierres del estudio (vacaciones, cierres puntuales). Los días también se
 * bloquean en Mery Booking (días libres de cada profesional); acá queda lo que
 * el bot tiene que decir:
 *
 * - {cierre} en una respuesta: el aviso desde AVISO_DIAS_ANTES días antes hasta
 *   el último día cerrado; fuera de eso desaparece solo.
 * - Durante el cierre, el pase a recepción avisa que están cerradas y cuándo
 *   vuelven, en lugar de prometer que recepción contesta.
 */
import { DateTime } from 'luxon';
import { TZ_LOCAL } from './horario';

export interface Cierre {
  /** Primer día cerrado (YYYY-MM-DD, hora de Argentina). */
  desde: string;
  /** Último día cerrado, inclusive. */
  hasta: string;
  /** "por vacaciones", "por feriado"… */
  motivo: string;
}

export const CIERRES: Cierre[] = [
  // Mery, 13/11/2026: cierran del 31/12 al 11/1 inclusive (31/12 y 1/1 no cuentan como vacaciones del staff).
  { desde: '2026-12-31', hasta: '2027-01-11', motivo: 'por vacaciones' },
];

export const AVISO_DIAS_ANTES = 60;

const DIA = [
  '',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

function hoyAR(ahora: Date): DateTime {
  return DateTime.fromJSDate(ahora, { zone: TZ_LOCAL }).startOf('day');
}

function fecha(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: TZ_LOCAL }).startOf('day');
}

/** "jueves 31/12". */
function diaYFecha(d: DateTime): string {
  return `${DIA[d.weekday]} ${d.toFormat('d/M')}`;
}

/** El cierre que incluye hoy, si hay. */
export function cierreEn(
  ahora: Date,
  cierres: Cierre[] = CIERRES,
): Cierre | null {
  const hoy = hoyAR(ahora);
  return (
    cierres.find((c) => hoy >= fecha(c.desde) && hoy <= fecha(c.hasta)) ?? null
  );
}

/** El cierre en curso o el próximo que empieza dentro de AVISO_DIAS_ANTES días. */
export function cierreParaAvisar(
  ahora: Date,
  cierres: Cierre[] = CIERRES,
): Cierre | null {
  const hoy = hoyAR(ahora);
  return (
    [...cierres]
      .sort((a, b) => a.desde.localeCompare(b.desde))
      .find(
        (c) =>
          hoy <= fecha(c.hasta) &&
          hoy >= fecha(c.desde).minus({ days: AVISO_DIAS_ANTES }),
      ) ?? null
  );
}

/** "Cerramos por vacaciones del jueves 31/12 al lunes 11/1 inclusive. Volvemos el martes 12/1 💖" */
export function textoCierre(c: Cierre, ahora: Date): string {
  const desde = fecha(c.desde);
  const hasta = fecha(c.hasta);
  // El estudio abre de martes a sábado: la vuelta es el primer día hábil después.
  let vuelta = hasta.plus({ days: 1 });
  while (vuelta.weekday === 7 || vuelta.weekday === 1)
    vuelta = vuelta.plus({ days: 1 });
  const yaEmpezo = hoyAR(ahora) >= desde;
  const rango = desde.equals(hasta)
    ? `el ${diaYFecha(desde)}`
    : `del ${diaYFecha(desde)} al ${diaYFecha(hasta)} inclusive`;
  const primera = yaEmpezo
    ? `Estamos cerradas ${c.motivo} hasta el ${diaYFecha(hasta)} inclusive.`
    : `Cerramos ${c.motivo} ${rango}.`;
  return `${primera} Volvemos el ${diaYFecha(vuelta)} 💖`;
}

/**
 * Reemplaza {cierre} por el aviso ("\n\n📌 …") si corresponde avisar, o lo saca
 * (con los saltos de línea de adelante) si no.
 */
export function aplicarCierre(
  texto: string,
  ahora: Date,
  cierres: Cierre[] = CIERRES,
): string {
  if (!texto.includes('{cierre}')) return texto;
  const c = cierreParaAvisar(ahora, cierres);
  return texto.replace(
    /\s*\{cierre\}/g,
    c ? `\n\n📌 ${textoCierre(c, ahora)}` : '',
  );
}
