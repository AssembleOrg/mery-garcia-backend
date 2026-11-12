import { RESPUESTAS_SEMILLA } from './respuestas.seed';
import {
  RESPUESTAS_V2,
  RESPUESTAS_V4,
  RESPUESTAS_V5,
} from './respuestas-v2.seed';
import { RESPUESTAS_V6 } from './respuestas-v6.seed';
import { RESPUESTAS_V7, TEXTOS_ANTERIORES_V7 } from './respuestas-v7.seed';
import { respuestasACorregir } from './tanda-glosario';

const ANTERIORES = [
  ...RESPUESTAS_SEMILLA,
  ...RESPUESTAS_V2,
  ...RESPUESTAS_V4,
  ...RESPUESTAS_V5,
  ...RESPUESTAS_V6,
];
const SEMILLA = new Map(
  [...ANTERIORES, ...RESPUESTAS_V7].map((s) => [s.clave, s.respuesta]),
);

describe('tanda 7 (cierres)', () => {
  it('horarios y reservar turno llevan {cierre}; el texto anterior no', () => {
    for (const clave of ['HORARIOS', 'TURNO_RESERVAR']) {
      expect(SEMILLA.get(clave)).toContain('{cierre}');
      expect(TEXTOS_ANTERIORES_V7[clave]).toBeDefined();
      expect(TEXTOS_ANTERIORES_V7[clave]).not.toContain('{cierre}');
    }
  });

  it('corrige sólo si sigue el texto anterior', () => {
    const cambios = respuestasACorregir(
      [
        {
          id: '1',
          clave: 'HORARIOS',
          respuesta: TEXTOS_ANTERIORES_V7.HORARIOS,
        },
        { id: '2', clave: 'TURNO_RESERVAR', respuesta: 'Editado por Mery' },
      ],
      TEXTOS_ANTERIORES_V7,
      SEMILLA,
    );
    expect(cambios.map((c) => c.clave)).toEqual(['HORARIOS']);
  });

  it('VACACIONES es nueva, válida y usa {cierre} y {horario}', () => {
    const claves = new Set(ANTERIORES.map((s) => s.clave));
    const v = RESPUESTAS_V7.find((s) => s.clave === 'VACACIONES')!;
    expect(claves.has('VACACIONES')).toBe(false);
    expect(v.respuesta).toContain('{cierre}');
    expect(v.respuesta).toContain('{horario}');
    expect(v.ejemplos.length).toBeLessThanOrEqual(12);
  });
});
