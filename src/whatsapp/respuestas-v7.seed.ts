/**
 * Tanda 7 (noviembre 2026): cierres del estudio (vacaciones). Las fechas están
 * en cierres.ts; {cierre} muestra el aviso sólo cuando corresponde.
 *
 * - RESPUESTAS_V7: claves nuevas (se agregan una sola vez, sin pisar).
 * - TEXTOS_ANTERIORES_V7: texto de antes; se actualiza sólo si nadie lo editó.
 */
import type { RespuestaSemilla } from './respuestas.seed';

export const VERSION_SEMILLA_V7 = 7;

export const RESPUESTAS_V7: RespuestaSemilla[] = [
  {
    clave: 'VACACIONES',
    titulo: 'Vacaciones y cierres (fin de año, enero)',
    descripcion:
      'Pregunta si trabajan en fin de año, en enero o en vacaciones, cuándo cierran o cuándo vuelven, o si abren un día puntual (feriado, 31/12, 2/1).',
    ejemplos: [
      '¿trabajan en enero?',
      '¿cuándo se van de vacaciones?',
      '¿abren entre las fiestas?',
      '¿cuándo vuelven?',
      '¿atienden el 2 de enero?',
      '¿cierran en verano?',
    ],
    respuesta:
      'Nuestro horario de atención es {horario} (los sábados, hasta las 16 hs).{cierre}\n\n' +
      'Los turnos se reservan desde https://merygarciabooking.com, donde ves todas las fechas disponibles 💕',
  },
];

/** Texto de cada respuesta antes de la tanda 7 (para actualizar sólo las que nadie editó). */
export const TEXTOS_ANTERIORES_V7: Record<string, string> = {
  HORARIOS:
    'Nuestro horario de atención es {horario}. Los sábados atendemos hasta las 16 hs. Lunes y domingos no abrimos.\nLos turnos se reservan desde la web, donde ves todas las disponibilidades: https://merygarciabooking.com',
  TURNO_RESERVAR:
    'Los turnos se reservan desde nuestra web, donde ves todas las disponibilidades en tiempo real y abonás la seña online 💕\n\n• Estilismo de cejas y pestañas: https://merygarciabooking.com/estilismo-de-cejas/\n• Cosmetic tattoo: https://merygarciabooking.com/tattoo-cosmetico/\n\nLos servicios que hace Mery figuran como *By Mery García*. Si es tu primera vez con cosmetic tattoo, primero va la consulta previa obligatoria.',
};
