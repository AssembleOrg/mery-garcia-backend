import {
  DiaAgenda,
  enumerar,
  fechaAR,
  nombreVisible,
  textoAgendaProfesionales,
  textoDiasDeLaSemana,
  textoFechas,
} from './agenda';

const dia = (
  date: string,
  dayOfWeek: string,
  dayState: string,
  horas: string[] = [],
): DiaAgenda => ({
  date,
  dayOfWeek,
  dayState,
  slots: horas.map((startTime) => ({ startTime, available: true })),
});

describe('agenda', () => {
  it('enumera en castellano', () => {
    expect(enumerar([])).toBe('');
    expect(enumerar(['a'])).toBe('a');
    expect(enumerar(['a', 'b'])).toBe('a y b');
    expect(enumerar(['a', 'b', 'c'])).toBe('a, b y c');
  });

  it('saca "Staff" del nombre', () => {
    expect(nombreVisible('Luna Staff')).toBe('Luna');
    expect(nombreVisible('Rosario  Staff ')).toBe('Rosario');
    expect(nombreVisible('Mery Garcia')).toBe('Mery Garcia');
  });

  it('lista fechas con día de la semana', () => {
    expect(
      textoFechas([
        dia('2026-11-17', 'TUESDAY', 'available'),
        dia('2026-11-21', 'SATURDAY', 'fully_booked'),
      ]),
    ).toBe('martes 17/11 y sábado 21/11');
  });

  it('una línea por profesional, contando los días completos y salteando los cerrados', () => {
    const texto = textoAgendaProfesionales([
      {
        nombre: 'Luna Staff',
        dias: [
          dia('2026-11-18', 'WEDNESDAY', 'available', ['10:00']),
          dia('2026-11-19', 'THURSDAY', 'closed'),
          dia('2026-11-21', 'SATURDAY', 'fully_booked'),
        ],
      },
      {
        nombre: 'Rosario Staff',
        dias: [dia('2026-11-17', 'TUESDAY', 'available', ['11:00'])],
      },
      { nombre: 'Nadie Staff', dias: [dia('2026-11-17', 'TUESDAY', 'closed')] },
    ]);
    expect(texto).toBe(
      '• *Luna*: miércoles 18/11 y sábado 21/11\n• *Rosario*: martes 17/11',
    );
  });

  it('sin días devuelve null', () => {
    expect(textoAgendaProfesionales([{ nombre: 'Luna', dias: [] }])).toBeNull();
    expect(
      textoDiasDeLaSemana([dia('2026-11-17', 'TUESDAY', 'closed')]),
    ).toBeNull();
  });

  it('resume días de la semana con la hora en punto', () => {
    expect(
      textoDiasDeLaSemana([
        dia('2026-11-18', 'WEDNESDAY', 'available', ['14:00']),
        dia('2026-11-25', 'WEDNESDAY', 'available', ['14:00']),
      ]),
    ).toBe('los miércoles a las 14 h');
  });

  it('agrupa días con la misma hora y separa los distintos', () => {
    expect(
      textoDiasDeLaSemana([
        dia('2026-11-17', 'TUESDAY', 'available', ['12:00']),
        dia('2026-11-19', 'THURSDAY', 'available', ['12:00', '12:30']),
        dia('2026-11-20', 'FRIDAY', 'available', ['14:00']),
      ]),
    ).toBe('los martes y jueves a las 12 h y los viernes a las 14 h');
  });

  it('un día completo cuenta sin hora; los turnos no disponibles no suman hora', () => {
    expect(
      textoDiasDeLaSemana([
        dia('2026-11-18', 'WEDNESDAY', 'fully_booked'),
        {
          date: '2026-11-20',
          dayOfWeek: 'FRIDAY',
          dayState: 'available',
          slots: [{ startTime: '12:00', available: false }],
        },
      ]),
    ).toBe('los miércoles y viernes');
  });

  it('sábados y domingos en plural', () => {
    expect(
      textoDiasDeLaSemana([
        dia('2026-11-21', 'SATURDAY', 'available', ['10:00', '12:00']),
      ]),
    ).toBe('los sábados a las 10 y 12 h');
  });

  it('fecha de hoy en Argentina, aunque en UTC ya sea mañana', () => {
    // 13/11 02:00 UTC = 12/11 23:00 en Argentina.
    expect(fechaAR(new Date('2026-11-13T02:00:00Z'))).toBe('2026-11-12');
    expect(fechaAR(new Date('2026-11-13T02:00:00Z'), 14)).toBe('2026-11-26');
  });
});
