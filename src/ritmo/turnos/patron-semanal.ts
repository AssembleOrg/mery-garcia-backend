import { AlternanciaTurno } from './entities/PatronTurno.entity';

/**
 * Horario con el que arranca el equipo. Es SEMILLA: se carga una sola vez en
 * `ritmo_patron_turno` y a partir de ahí el patrón vive en la base y se edita
 * desde la pantalla de horarios. Cambiar este archivo no cambia nada de lo ya
 * cargado.
 */

/** 1 = lunes … 7 = domingo (ISO). */
export type DiaIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TramoSemilla {
  dia: DiaIso;
  /** "HH:MM" en la zona de la empresa. */
  desde: string;
  hasta: string;
  alternancia?: AlternanciaTurno;
}

export interface PersonaSemilla {
  email: string;
  nombre: string;
  tramos: TramoSemilla[];
}

/** Jornada corrida: no se descuenta pausa. */
export const PAUSA_MINUTOS = 0;

const MAR = 2 as const;
const MIE = 3 as const;
const JUE = 4 as const;
const VIE = 5 as const;
const SAB = 6 as const;

/**
 * Lunes de una semana "A". A partir de acá las semanas alternan A, B, A, B…
 * Sólo importa para los tramos que no son TODAS (hoy, el sábado de Luna).
 * Si el sábado largo y el corto salen al revés, mové esta fecha una semana.
 */
export const ANCLA_SEMANA_A = '2026-09-14';

export const SEMILLA_PATRON: PersonaSemilla[] = [
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
      { dia: SAB, desde: '10:00', hasta: '18:00', alternancia: AlternanciaTurno.SEMANA_A },
      { dia: SAB, desde: '10:00', hasta: '15:00', alternancia: AlternanciaTurno.SEMANA_B },
    ],
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
