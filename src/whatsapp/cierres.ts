/**
 * Cierres del estudio (vacaciones, cierres puntuales). Las fechas se cargan
 * desde el panel (Configuración > WhatsApp > Bot); los días también se bloquean
 * en Mery Booking (días libres de cada profesional). Acá queda lo que el bot
 * tiene que decir:
 *
 * - {cierre} en una respuesta: el aviso desde diasAvisoCierre días antes hasta
 *   el último día cerrado; fuera de eso desaparece solo.
 * - Durante el cierre, el pase a recepción avisa que están cerradas y cuándo
 *   vuelven, en lugar de prometer que recepción contesta.
 */
import { DateTime } from 'luxon';
import type { CierreEstudio } from './entities/WhatsappConfig.entity';
import { TZ_LOCAL } from './horario';

export type Cierre = CierreEstudio;

/** Cierres cargados al pasar las fechas del código a la configuración (tanda 8). */
export const CIERRES_INICIALES: Cierre[] = [
  // Mery, 13/11/2026: cierran del 31/12 al 11/1 inclusive (31/12 y 1/1 no cuentan como vacaciones del staff).
  { desde: '2026-12-31', hasta: '2027-01-11', motivo: 'por vacaciones' },
];

/** Por defecto; se configura desde el panel (diasAvisoCierre). */
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
export function cierreEn(ahora: Date, cierres: Cierre[]): Cierre | null {
  const hoy = hoyAR(ahora);
  return (
    cierres.find((c) => hoy >= fecha(c.desde) && hoy <= fecha(c.hasta)) ?? null
  );
}

/** El cierre en curso o el próximo que empieza dentro de AVISO_DIAS_ANTES días. */
export function cierreParaAvisar(
  ahora: Date,
  cierres: Cierre[],
  diasAntes = AVISO_DIAS_ANTES,
): Cierre | null {
  const hoy = hoyAR(ahora);
  return (
    [...cierres]
      .sort((a, b) => a.desde.localeCompare(b.desde))
      .find(
        (c) =>
          hoy <= fecha(c.hasta) &&
          hoy >= fecha(c.desde).minus({ days: diasAntes }),
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
  cierres: Cierre[],
  diasAntes = AVISO_DIAS_ANTES,
): string {
  if (!texto.includes('{cierre}')) return texto;
  const c = cierreParaAvisar(ahora, cierres, diasAntes);
  return texto.replace(
    /\s*\{cierre\}/g,
    c ? `\n\n📌 ${textoCierre(c, ahora)}` : '',
  );
}

/**
 * Valida y normaliza los cierres que llegan del panel. Devuelve el error en
 * castellano (para mostrar) o la lista limpia, ordenada por fecha.
 */
export function validarCierres(
  entrada: unknown,
): { ok: true; cierres: Cierre[] } | { ok: false; error: string } {
  if (!Array.isArray(entrada))
    return { ok: false, error: 'Los cierres tienen que ser una lista.' };
  if (entrada.length > 30) return { ok: false, error: 'Máximo 30 cierres.' };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const cierres: Cierre[] = [];
  for (const [i, c] of entrada.entries()) {
    const n = i + 1;
    const { desde, hasta, motivo } = (c ?? {}) as Record<string, unknown>;
    if (
      typeof desde !== 'string' ||
      !iso.test(desde) ||
      !DateTime.fromISO(desde).isValid
    ) {
      return {
        ok: false,
        error: `Cierre ${n}: la fecha "desde" no es válida.`,
      };
    }
    if (
      typeof hasta !== 'string' ||
      !iso.test(hasta) ||
      !DateTime.fromISO(hasta).isValid
    ) {
      return {
        ok: false,
        error: `Cierre ${n}: la fecha "hasta" no es válida.`,
      };
    }
    if (hasta < desde)
      return {
        ok: false,
        error: `Cierre ${n}: "hasta" es anterior a "desde".`,
      };
    if (
      DateTime.fromISO(hasta).diff(DateTime.fromISO(desde), 'days').days > 120
    ) {
      return {
        ok: false,
        error: `Cierre ${n}: no puede durar más de 120 días.`,
      };
    }
    const m =
      typeof motivo === 'string' && motivo.trim()
        ? motivo.trim()
        : 'por vacaciones';
    if (m.length > 60)
      return {
        ok: false,
        error: `Cierre ${n}: el motivo es muy largo (máximo 60).`,
      };
    cierres.push({ desde, hasta, motivo: m });
  }
  cierres.sort((a, b) => a.desde.localeCompare(b.desde));
  return { ok: true, cierres };
}
