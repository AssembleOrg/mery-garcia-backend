import type { HorarioAtencion } from './entities/WhatsappConfig.entity';

/** Horario por defecto hasta la tanda 6 (decía que abrían los lunes y hasta las 19). */
export const HORARIO_ANTERIOR: HorarioAtencion = {
  dias: [1, 2, 3, 4, 5, 6],
  desde: '10:00',
  hasta: '19:00',
};
/** Martes a sábado de 10 a 18 (los sábados cierran a las 16; lo dicen las respuestas). */
export const HORARIO_ESTUDIO: HorarioAtencion = {
  dias: [2, 3, 4, 5, 6],
  desde: '10:00',
  hasta: '18:00',
};

function mismoHorario(
  a: HorarioAtencion | null | undefined,
  b: HorarioAtencion,
): boolean {
  if (!a) return false;
  const dias = [...(a.dias ?? [])].sort((x, y) => x - y);
  return (
    a.desde === b.desde &&
    a.hasta === b.hasta &&
    dias.join(',') === b.dias.join(',')
  );
}

/** El horario guardado, corregido sólo si sigue siendo el de antes (si Mery lo cambió, queda el suyo). */
export function horarioCorregido(
  guardado: HorarioAtencion | null | undefined,
): HorarioAtencion | null {
  return mismoHorario(guardado, HORARIO_ANTERIOR) ? HORARIO_ESTUDIO : null;
}

/**
 * Qué respuestas guardadas pasan al texto nuevo: las que siguen exactamente con
 * el texto anterior de la semilla. Las editadas desde el panel no se tocan.
 */
export function respuestasACorregir(
  guardadas: { id: string; clave: string; respuesta: string }[],
  anteriores: Record<string, string>,
  nuevas: Map<string, string>,
): { id: string; clave: string; respuesta: string }[] {
  const cambios: { id: string; clave: string; respuesta: string }[] = [];
  for (const g of guardadas) {
    const anterior = anteriores[g.clave];
    const nueva = nuevas.get(g.clave);
    if (anterior === undefined || nueva === undefined || nueva === anterior)
      continue;
    if (g.respuesta === anterior)
      cambios.push({ id: g.id, clave: g.clave, respuesta: nueva });
  }
  return cambios;
}
