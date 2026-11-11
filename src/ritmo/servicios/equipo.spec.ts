import type { LineaComision } from 'src/comanda/comisiones/detalle';
import {
  MAX_DIAS_EQUIPO,
  armarCatalogo,
  armarEquipo,
  validarRango,
  type DiaTrabajado,
  type TrabajadoraEquipo,
} from './equipo';
import { armarLineas } from './resumen';

const CATS = [
  { id: 'b', nombre: 'Categoría B', orden: 2 },
  { id: 'a', nombre: 'Categoría A', orden: 1 },
];

const trabajadora = (
  id: string,
  nombre: string,
  extra: Partial<TrabajadoraEquipo> = {},
): TrabajadoraEquipo => ({
  id,
  nombre,
  activo: true,
  borrada: false,
  ritmoUserId: `ritmo-${id}`,
  ritmoConfirmaServicios: false,
  ...extra,
});

const dia = (
  trabajadorId: string,
  d: string,
  a: number,
  extra: Partial<DiaTrabajado> = {},
): DiaTrabajado => {
  const lineas = armarLineas(
    CATS,
    a ? [{ categoriaId: 'a', cantidad: a, validadas: a }] : [],
  );
  return {
    trabajadorId,
    dia: d,
    comandas: a,
    lineas,
    total: a,
    confirmacion: null,
    ...extra,
  };
};

const linea = (
  d: string,
  numero: string,
  item: string,
  extra: Partial<LineaComision> = {},
): LineaComision => ({
  comandaId: numero,
  numero,
  dia: d,
  hora: '10:00',
  cliente: null,
  validada: true,
  tipo: 'SERVICIO',
  item,
  categoria: 'Categoría A',
  cantidad: 1,
  moneda: 'ARS',
  base: 100,
  porcentaje: 30,
  porcentajeMax: 30,
  confirmado: true,
  comision: 30,
  comisionMax: 30,
  esquemaBase: true,
  nota: null,
  ...extra,
});

const base = {
  desde: '2026-11-09',
  hasta: '2026-11-15',
  resumenDesde: '2026-11-01',
  categorias: CATS,
  detalle: new Map<string, LineaComision[]>(),
};

describe('producción del equipo para Ritmo', () => {
  it('valida el rango y lo acota', () => {
    expect(validarRango('2026-11-09', '2026-11-15')).toBe(7);
    expect(validarRango('2026-11-09', '2026-11-09')).toBe(1);
    expect(() => validarRango('2026-11-15', '2026-11-09')).toThrow('anterior');
    expect(() => validarRango('2026-11-09', 'mañana')).toThrow('AAAA-MM-DD');
    expect(() => validarRango('2026-10-01', '2026-11-15')).toThrow(
      `${MAX_DIAS_EQUIPO} días`,
    );
    expect(validarRango('2026-10-01', '2026-10-31')).toBe(31);
  });

  it('pone a todas las activas por nombre, aunque no hayan hecho nada', () => {
    const r = armarEquipo({
      ...base,
      trabajadoras: [
        trabajadora('r', 'Rosario'),
        trabajadora('l', 'Luna'),
        trabajadora('m', 'Mery Garcia', { ritmoUserId: null }),
      ],
      dias: [dia('l', '2026-11-10', 3)],
    });
    expect(r.people.map((p) => [p.name, p.userId, p.days.length])).toEqual([
      ['Luna', 'ritmo-l', 1],
      ['Mery Garcia', null, 0],
      ['Rosario', 'ritmo-r', 0],
    ]);
    expect(r.categories.map((c) => c.label)).toEqual([
      'Categoría A',
      'Categoría B',
    ]);
    expect([r.from, r.to]).toEqual(['2026-11-09', '2026-11-15']);
    expect(r.people.map((p) => p.highlights[0])).toEqual([
      { key: 'comandas', label: 'comandas', count: 3 },
      { key: 'comandas', label: 'comandas', count: 0 },
      { key: 'comandas', label: 'comandas', count: 0 },
    ]);
    expect(r.highlights).toEqual([
      { key: 'comandas', label: 'comandas', count: 3 },
      { key: 'productos', label: 'productos', count: 0 },
    ]);
  });

  it('deja afuera a las dadas de baja, salvo que tengan algo en el rango', () => {
    const r = armarEquipo({
      ...base,
      trabajadoras: [
        trabajadora('f', 'Florencia', { borrada: true }),
        trabajadora('s', 'Sofia', { activo: false }),
        trabajadora('l', 'Luna'),
      ],
      dias: [dia('s', '2026-11-09', 1)],
    });
    expect(r.people.map((p) => p.name)).toEqual(['Luna', 'Sofia']);
  });

  it('cada día lleva sus categorías, sus comandas y sólo los servicios de ese día', () => {
    const r = armarEquipo({
      ...base,
      trabajadoras: [trabajadora('l', 'Luna')],
      dias: [dia('l', '2026-11-11', 1), dia('l', '2026-11-10', 2)],
      detalle: new Map([
        [
          'l',
          [
            linea('2026-11-10', '01-1', 'Laminado'),
            linea('2026-11-10', '01-2', 'Laminado'),
            linea('2026-11-11', '01-3', 'Refill', { validada: false }),
          ],
        ],
      ]),
    });
    const [lunes, martes] = r.people[0].days;
    expect([lunes.day, martes.day]).toEqual(['2026-11-10', '2026-11-11']);
    expect(lunes.highlights).toEqual([
      { key: 'comandas', label: 'comandas', count: 2 },
      { key: 'productos', label: 'productos', count: 0 },
    ]);
    expect(lunes.items.map((i) => [i.label, i.count])).toEqual([
      ['Categoría A', 2],
      ['Categoría B', 0],
    ]);
    expect(lunes.total).toBe(2);
    expect(lunes.sections[0].lines.map((l) => [l.label, l.detail])).toEqual([
      ['Laminado ×2', 'Categoría A · Comandas 01-1 · 01-2'],
    ]);
    expect(martes.sections[0].lines.map((l) => [l.label, l.badge])).toEqual([
      ['Refill', 'sin validar'],
    ]);
    // Sin plata, en ningún renglón.
    expect(
      r.people[0].days.flatMap((d) =>
        d.sections.flatMap((s) => s.lines.map((l) => l.amount)),
      ),
    ).toEqual([null, null]);
  });

  it('los productos vendidos: por día, por persona y de todo el equipo', () => {
    const crema = (numero: string, cantidad = 1) => ({
      item: 'Crema',
      numero,
      cantidad,
      validada: true,
    });
    const r = armarEquipo({
      ...base,
      trabajadoras: [trabajadora('l', 'Luna'), trabajadora('r', 'Rosario')],
      dias: [
        dia('l', '2026-11-10', 2, { productos: [crema('01-1', 2)] }),
        dia('l', '2026-11-11', 1, { productos: [crema('01-3')] }),
        // Sólo vendió un producto: sin servicios, pero estuvo en una comanda.
        dia('r', '2026-11-11', 0, { comandas: 1, productos: [crema('01-9')] }),
      ],
      detalle: new Map([['l', [linea('2026-11-10', '01-1', 'Laminado')]]]),
    });
    const [luna, rosario] = r.people;
    expect(luna.days.map((d) => d.highlights[1])).toEqual([
      { key: 'productos', label: 'productos', count: 2 },
      { key: 'productos', label: 'producto', count: 1 },
    ]);
    expect(
      luna.days[0].sections.map((s) => [s.key, s.lines.map((l) => l.label)]),
    ).toEqual([
      ['servicios', ['Laminado']],
      ['productos', ['Crema ×2']],
    ]);
    expect(luna.highlights).toEqual([
      { key: 'comandas', label: 'comandas', count: 3 },
      { key: 'productos', label: 'productos', count: 3 },
    ]);
    expect(rosario.days[0]).toMatchObject({
      total: 0,
      highlights: [
        { key: 'comandas', label: 'comanda', count: 1 },
        { key: 'productos', label: 'producto', count: 1 },
      ],
      sections: [
        {
          key: 'productos',
          lines: [{ label: 'Crema', detail: 'Comanda 01-9', amount: null }],
        },
      ],
    });
    expect(r.highlights).toEqual([
      { key: 'comandas', label: 'comandas', count: 4 },
      { key: 'productos', label: 'productos', count: 4 },
    ]);
  });

  it('la confirmación: pendiente, hecha, discutida, o no corresponde', () => {
    const confirmadoEn = new Date('2026-11-10T21:00:00.000Z');
    const r = armarEquipo({
      ...base,
      resumenDesde: '2026-11-10',
      trabajadoras: [
        trabajadora('l', 'Luna', { ritmoConfirmaServicios: true }),
        trabajadora('i', 'Ivonne'),
        trabajadora('m', 'Mery Garcia', { ritmoUserId: null }),
      ],
      dias: [
        // Antes del arranque: no se confirma.
        dia('l', '2026-11-09', 2),
        dia('l', '2026-11-10', 2, {
          confirmacion: { confirmadoEn, conforme: true, nota: null },
        }),
        dia('l', '2026-11-11', 1, {
          confirmacion: { confirmadoEn, conforme: false, nota: 'Falta uno' },
        }),
        // Luna confirma siempre, aunque no haya estado en comandas.
        dia('l', '2026-11-12', 0),
        dia('i', '2026-11-10', 1),
        // Sin Ritmo no hay cómo confirmar.
        dia('m', '2026-11-10', 4),
      ],
    });
    const [ivonne, luna, mery] = r.people;
    expect(luna.days.map((d) => d.confirmation)).toEqual([
      null,
      {
        required: true,
        confirmedAt: '2026-11-10T21:00:00.000Z',
        agreed: true,
        note: null,
      },
      {
        required: true,
        confirmedAt: '2026-11-10T21:00:00.000Z',
        agreed: false,
        note: 'Falta uno',
      },
      { required: true, confirmedAt: null, agreed: null, note: null },
    ]);
    expect(ivonne.days[0].confirmation).toEqual({
      required: true,
      confirmedAt: null,
      agreed: null,
      note: null,
    });
    expect(mery.days[0].confirmation).toBeNull();
  });
});

describe('catálogo de categorías para Ritmo', () => {
  it('categorías en orden con sus servicios, y lo suelto al final', () => {
    const r = armarCatalogo(
      [
        { id: 'b', nombre: 'Categoría B', orden: 2, descripcion: ' Tintes ' },
        { id: 'a', nombre: 'Categoría A', orden: 1 },
        { id: 'c', nombre: 'Categoría C', orden: 3, descripcion: null },
      ],
      [
        { id: '1', nombre: 'Refill', categoriaId: 'a' },
        { id: '2', nombre: 'Laminado', categoriaId: 'a' },
        { id: '3', nombre: 'Tinte', categoriaId: 'b' },
        { id: '4', nombre: 'Consulta', categoriaId: null },
        { id: '5', nombre: 'Viejo', categoriaId: 'borrada' },
      ],
    );
    expect(r.title).toBe('Categorías de servicios');
    expect(
      r.groups.map((g) => [g.label, g.detail, g.items.map((i) => i.label)]),
    ).toEqual([
      ['Categoría A', null, ['Laminado', 'Refill']],
      ['Categoría B', 'Tintes', ['Tinte']],
      ['Categoría C', null, []],
      [
        'Sin categoría',
        'Servicios que todavía no tienen categoría: no suman en A, B ni C.',
        ['Consulta', 'Viejo'],
      ],
    ]);
  });

  it('sin servicios sueltos no hay grupo "Sin categoría"', () => {
    const r = armarCatalogo(
      [{ id: 'a', nombre: 'Categoría A', orden: 1 }],
      [{ id: '1', nombre: 'Refill', categoriaId: 'a' }],
    );
    expect(r.groups.map((g) => g.label)).toEqual(['Categoría A']);
  });
});
