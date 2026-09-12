/**
 * Horario fijo del equipo. Ritmo no repite semanas: cada turno se carga uno por
 * uno. Este patrón es la fuente de verdad y el generador arma la semana desde
 * acá, así nadie carga turnos a mano todas las semanas.
 *
 * Las personas se identifican por email porque es lo que se lee; el generador
 * lo resuelve contra el personal de Ritmo y avisa si alguno no existe.
 */

/** 1 = lunes … 7 = domingo (ISO). */
export type DiaIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TramoTurno {
  dia: DiaIso;
  /** "HH:MM" en la zona de la empresa. */
  desde: string;
  hasta: string;
}

export interface PatronPersona {
  email: string;
  nombre: string;
  tramos: TramoTurno[];
  /**
   * Sábado que alterna de duración: el turno del sábado sale de `tramos` en las
   * semanas "largas" y de `alterna` en las del medio. Sólo lo usa Luna.
   */
  alterna?: { dia: DiaIso; desde: string; hasta: string };
}

/** Jornada corrida: no se descuenta pausa. */
export const BREAK_MINUTES = 0;

const MAR = 2 as const;
const MIE = 3 as const;
const JUE = 4 as const;
const VIE = 5 as const;
const SAB = 6 as const;

/**
 * Sábado tomado como "largo" (hasta las 18). A partir de acá alterna cada 14
 * días: si arranca corrido al revés, mové esta fecha una semana.
 */
export const ANCLA_SABADO_LARGO = '2026-09-19';

export const PATRON_SEMANAL: PatronPersona[] = [
  {
    email: 'micaela@merygarcia.local',
    nombre: 'Micaela',
    tramos: [MAR, MIE, JUE, VIE, SAB].map((dia) => ({
      dia,
      desde: '10:00',
      hasta: '18:00',
    })),
  },
  {
    email: 'rosario@merygarcia.local',
    nombre: 'Rosario Nauda',
    tramos: [MAR, JUE, VIE].map((dia) => ({
      dia,
      desde: '11:00',
      hasta: '18:00',
    })),
  },
  {
    // Miércoles fijo y sábado por medio: 10–18 una semana, 10–15 la otra.
    email: 'luna@merygarcia.local',
    nombre: 'Luna García',
    tramos: [
      { dia: MIE, desde: '10:00', hasta: '18:00' },
      { dia: SAB, desde: '10:00', hasta: '18:00' },
    ],
    alterna: { dia: SAB, desde: '10:00', hasta: '15:00' },
  },
  {
    // Limpieza antes de abrir. El lunes que a veces viene no se planifica a
    // propósito: si se planifica y no viene, queda ausente; sin turno, la marca
    // entra igual y se ve como trabajo extra.
    email: 'karina@merygarcia.local',
    nombre: 'Karina Navarro',
    tramos: [MAR, MIE, JUE, VIE, SAB].map((dia) => ({
      dia,
      desde: '07:00',
      hasta: '09:00',
    })),
  },
  {
    email: 'ivonne@merygarcia.local',
    nombre: 'Ivonne',
    tramos: [
      ...[MAR, MIE, VIE, SAB].map((dia) => ({
        dia,
        desde: '10:00',
        hasta: '18:00',
      })),
      { dia: JUE, desde: '10:00', hasta: '14:00' },
    ],
  },
];
