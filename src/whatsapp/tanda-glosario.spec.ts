import { RESPUESTAS_SEMILLA } from './respuestas.seed';
import {
  RESPUESTAS_V2,
  RESPUESTAS_V4,
  RESPUESTAS_V5,
} from './respuestas-v2.seed';
import { RESPUESTAS_V6, TEXTOS_ANTERIORES_V6 } from './respuestas-v6.seed';
import {
  HORARIO_ANTERIOR,
  HORARIO_ESTUDIO,
  horarioCorregido,
  respuestasACorregir,
} from './tanda-glosario';

const SEMILLA = new Map(
  [
    ...RESPUESTAS_SEMILLA,
    ...RESPUESTAS_V2,
    ...RESPUESTAS_V4,
    ...RESPUESTAS_V5,
    ...RESPUESTAS_V6,
  ].map((s) => [s.clave, s.respuesta]),
);

describe('tanda 6 (glosario de recepción)', () => {
  it('corrige sólo las respuestas que siguen con el texto anterior', () => {
    const guardadas = [
      { id: '1', clave: 'SENA', respuesta: TEXTOS_ANTERIORES_V6.SENA },
      {
        id: '2',
        clave: 'UBICACION',
        respuesta: 'Texto que Mery editó desde el panel',
      },
      { id: '3', clave: 'SALUDO', respuesta: 'Hola!' },
    ];
    const cambios = respuestasACorregir(
      guardadas,
      TEXTOS_ANTERIORES_V6,
      SEMILLA,
    );
    expect(cambios).toEqual([
      { id: '1', clave: 'SENA', respuesta: SEMILLA.get('SENA') },
    ]);
    expect(cambios[0].respuesta).toContain('no es reembolsable');
  });

  it('cada texto anterior corresponde a una respuesta de la semilla que cambió', () => {
    for (const [clave, anterior] of Object.entries(TEXTOS_ANTERIORES_V6)) {
      expect(SEMILLA.has(clave)).toBe(true);
      expect(SEMILLA.get(clave)).not.toBe(anterior);
    }
  });

  it('las respuestas corregidas ya no tienen días ni montos de consulta escritos a mano', () => {
    for (const clave of ['NANOBLADING_QUIERO', 'LIP_BLUSH_QUIERO']) {
      const texto = SEMILLA.get(clave)!;
      expect(texto).not.toMatch(/\$\s?\d/);
      expect(texto).not.toMatch(/martes|jueves|viernes/i);
      expect(texto).toContain('{dias:');
    }
  });

  it('las claves nuevas no pisan ninguna existente y son válidas', () => {
    const viejas = new Set(
      [
        ...RESPUESTAS_SEMILLA,
        ...RESPUESTAS_V2,
        ...RESPUESTAS_V4,
        ...RESPUESTAS_V5,
      ].map((s) => s.clave),
    );
    const nuevas = RESPUESTAS_V6.map((s) => s.clave);
    expect(new Set(nuevas).size).toBe(nuevas.length);
    for (const s of RESPUESTAS_V6) {
      expect(viejas.has(s.clave)).toBe(false);
      expect(s.clave).toMatch(/^[A-Z][A-Z0-9_]{1,63}$/);
      expect(s.titulo.length).toBeLessThanOrEqual(160);
      expect(s.descripcion.length).toBeLessThanOrEqual(600);
      expect(s.respuesta.length).toBeLessThanOrEqual(4000);
      expect(s.ejemplos.length).toBeLessThanOrEqual(12);
    }
  });

  it('los días de las estilistas salen de la agenda, no escritos a mano', () => {
    const quien = RESPUESTAS_V6.find((s) => s.clave === 'QUIEN_ATIENDE')!;
    expect(quien.respuesta).toContain('{agenda:');
    expect(quien.respuesta).not.toMatch(/miércoles|sábado/);
  });

  it('pasa el horario viejo a martes a sábado de 10 a 18, y respeta uno editado', () => {
    expect(horarioCorregido(HORARIO_ANTERIOR)).toEqual(HORARIO_ESTUDIO);
    expect(
      horarioCorregido({
        dias: [6, 5, 4, 3, 2, 1],
        desde: '10:00',
        hasta: '19:00',
      }),
    ).toEqual(HORARIO_ESTUDIO);
    expect(
      horarioCorregido({
        dias: [2, 3, 4, 5, 6],
        desde: '09:00',
        hasta: '18:00',
      }),
    ).toBeNull();
    expect(horarioCorregido(null)).toBeNull();
  });
});
