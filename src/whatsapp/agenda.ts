/**
 * Textos de agenda en vivo a partir de la disponibilidad pública de la web de
 * turnos (GET /api/bookings/availability). Funciones puras: CatalogoService
 * trae los datos y esto arma el texto.
 *
 * Un día con agenda abierta pero completa ("fully_booked") cuenta como día en
 * que la profesional trabaja; "closed" es que ese día no viene.
 */

export interface SlotAgenda {
  startTime: string; // "HH:MM"
  available?: boolean;
}

export interface DiaAgenda {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // MONDAY..SUNDAY
  dayState: string; // available | fully_booked | closed
  slots: SlotAgenda[];
}

const ORDEN = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const DIA: Record<string, string> = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábado',
  SUNDAY: 'domingo',
};
const DIAS: Record<string, string> = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábados',
  SUNDAY: 'domingos',
};

/** "a", "a y b", "a, b y c". */
export function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Días en que la profesional tiene agenda (libre o completa). */
export function diasQueTrabaja(dias: DiaAgenda[]): DiaAgenda[] {
  return dias.filter((d) => d.dayState !== 'closed');
}

/** "Luna Staff" → "Luna". */
export function nombreVisible(nombreCompleto: string): string {
  return nombreCompleto
    .replace(/\bstaff\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "martes 17/11, jueves 19/11 y viernes 20/11". */
export function textoFechas(dias: DiaAgenda[]): string {
  return enumerar(
    dias.map((d) =>
      `${DIA[d.dayOfWeek] ?? ''} ${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`.trim(),
    ),
  );
}

/**
 * Una línea por profesional con sus próximos días ("• *Luna*: miércoles 18/11
 * y sábado 21/11"). Null si nadie tiene días en el período.
 */
export function textoAgendaProfesionales(
  items: { nombre: string; dias: DiaAgenda[] }[],
): string | null {
  const lineas = items
    .map((i) => ({
      nombre: nombreVisible(i.nombre),
      dias: diasQueTrabaja(i.dias),
    }))
    .filter((i) => i.nombre && i.dias.length)
    .map((i) => `• *${i.nombre}*: ${textoFechas(i.dias)}`);
  return lineas.length ? lineas.join('\n') : null;
}

/**
 * Días de la semana (y horas en punto) con agenda en el período, juntando todas
 * las profesionales y servicios: "los miércoles a las 14 h", "los martes y
 * jueves a las 12 h", "los martes a las 12 h y los viernes a las 14 h".
 * Las horas salen de los turnos libres; un día completo aporta el día sin hora.
 * Null si no hay ningún día.
 */
export function textoDiasDeLaSemana(dias: DiaAgenda[]): string | null {
  const porDia = new Map<string, Set<number>>();
  for (const d of diasQueTrabaja(dias)) {
    const horas = porDia.get(d.dayOfWeek) ?? new Set<number>();
    for (const s of d.slots ?? []) {
      if (s.available === false || !/^\d{2}:00$/.test(s.startTime)) continue;
      horas.add(Number(s.startTime.slice(0, 2)));
    }
    porDia.set(d.dayOfWeek, horas);
  }
  if (!porDia.size) return null;
  const grupos = new Map<string, string[]>();
  for (const dia of ORDEN) {
    const horas = porDia.get(dia);
    if (!horas) continue;
    const clave = [...horas].sort((a, b) => a - b).join(',');
    grupos.set(clave, [...(grupos.get(clave) ?? []), dia]);
  }
  const partes = [...grupos].map(([horas, diasSemana]) => {
    const cuando = `los ${enumerar(diasSemana.map((d) => DIAS[d] ?? d.toLowerCase()))}`;
    return horas ? `${cuando} a las ${enumerar(horas.split(','))} h` : cuando;
  });
  return enumerar(partes);
}

/** Fecha de hoy en Argentina (YYYY-MM-DD) más `dias` días. */
export function fechaAR(ahora: Date, dias = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(ahora);
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
