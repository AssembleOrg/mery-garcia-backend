import { EstadoSolicitudStock } from './entities/SolicitudStock.entity';
import {
  OPCION_ANULAR,
  OPCION_CONFIRMAR,
  buscarEnCatalogo,
  decisionDelVoto,
  etiquetaEstado,
  juntarIguales,
  tituloEncuesta,
  validarPedidoRitmo,
  votanteAutorizado,
} from './registro-productos';

const USER = '7ba83050-9881-4c57-b94d-450721120663';
const PROD = '11111111-1111-4111-8111-111111111111';

describe('registro de productos desde Ritmo', () => {
  it('valida el alta: ítems, cantidades, texto libre y nota', () => {
    const p = validarPedidoRitmo({
      userId: USER,
      action: 'create',
      items: [
        { productId: PROD, name: 'Shampoo', quantity: 1 },
        { productId: null, name: '  Guantes ', quantity: 2 },
        { name: 'guantes' },
      ],
      note: '  clienta de laminado ',
    });
    expect(p).toEqual({
      accion: 'crear',
      userId: USER,
      items: [
        { productoId: PROD, nombre: 'Shampoo', cantidad: 1 },
        { productoId: null, nombre: 'Guantes', cantidad: 3 },
      ],
      nota: 'clienta de laminado',
    });
  });

  it('rechaza lo mal armado con un motivo que se puede mostrar', () => {
    const base = { userId: USER, action: 'create' };
    expect(() => validarPedidoRitmo(null)).toThrow('Falta el cuerpo');
    expect(() => validarPedidoRitmo({ ...base, userId: 'x' })).toThrow(
      'userId',
    );
    expect(() => validarPedidoRitmo({ ...base, items: [] })).toThrow(
      'al menos un',
    );
    expect(() =>
      validarPedidoRitmo({ ...base, items: [{ name: 'a', quantity: 21 }] }),
    ).toThrow('de 1 a 20');
    expect(() =>
      validarPedidoRitmo({ ...base, items: [{ name: 'a', quantity: 1.5 }] }),
    ).toThrow('de 1 a 20');
    expect(() =>
      validarPedidoRitmo({ ...base, items: [{ name: '   ' }] }),
    ).toThrow('sin nombre');
    expect(() =>
      validarPedidoRitmo({ ...base, items: [{ productId: 'x', name: 'a' }] }),
    ).toThrow('productId');
    expect(() =>
      validarPedidoRitmo({
        ...base,
        items: Array.from({ length: 21 }, () => ({ name: 'a' })),
      }),
    ).toThrow('Como mucho 20');
    expect(() =>
      validarPedidoRitmo({
        ...base,
        items: [{ name: 'a' }],
        note: 'x'.repeat(301),
      }),
    ).toThrow('hasta 300');
    expect(() => validarPedidoRitmo({ ...base, action: 'borrar' })).toThrow(
      'action',
    );
  });

  it('valida la cancelación', () => {
    expect(
      validarPedidoRitmo({ userId: USER, action: 'cancel', recordId: PROD }),
    ).toEqual({ accion: 'cancelar', userId: USER, registroId: PROD });
    expect(() =>
      validarPedidoRitmo({ userId: USER, action: 'cancel', recordId: 'x' }),
    ).toThrow('recordId');
  });

  it('suma repetidos sin pasarse de 20', () => {
    expect(
      juntarIguales([
        { productoId: PROD, nombre: 'A', cantidad: 15 },
        { productoId: PROD, nombre: 'A', cantidad: 10 },
        { productoId: null, nombre: 'Gasa', cantidad: 1 },
        { productoId: null, nombre: 'gasa ', cantidad: 1 },
      ]),
    ).toEqual([
      { productoId: PROD, nombre: 'A', cantidad: 20 },
      { productoId: null, nombre: 'Gasa', cantidad: 2 },
    ]);
  });

  it('busca sin tildes, con todas las palabras, primero lo que empieza igual', () => {
    const cat = [
      { nombre: 'Crema ácida' },
      { nombre: 'Ácido hialurónico' },
      { nombre: 'Shampoo neutro' },
      { nombre: 'Hisopos' },
    ];
    expect(buscarEnCatalogo(cat, 'acid').map((p) => p.nombre)).toEqual([
      'Ácido hialurónico',
      'Crema ácida',
    ]);
    expect(buscarEnCatalogo(cat, 'crema ACIDA').map((p) => p.nombre)).toEqual([
      'Crema ácida',
    ]);
    expect(buscarEnCatalogo(cat, '   ')).toEqual([]);
    expect(buscarEnCatalogo(cat, 'zzz')).toEqual([]);
  });

  it('la etiqueta de pendiente dice a qué hora se confirma sola', () => {
    const creada = new Date('2026-11-01T18:42:00Z'); // 15:42 en el salón
    expect(etiquetaEstado(EstadoSolicitudStock.PENDIENTE, creada, 60)).toBe(
      'Se confirma sola a las 16:42',
    );
    expect(etiquetaEstado(EstadoSolicitudStock.RECHAZADA, creada, 60)).toBe(
      'Anulado',
    );
  });

  it('el título de la encuesta alcanza para decidir y no pasa de 255', () => {
    const creada = new Date('2026-11-01T18:42:00Z');
    expect(
      tituloEncuesta({
        nombre: 'Luna',
        items: [
          { nombre: 'Shampoo neutro', cantidad: 1 },
          { nombre: 'Hisopos', cantidad: 3, libre: true },
        ],
        nota: 'clienta de laminado',
        creada,
      }),
    ).toBe(
      '🧴 Luna anotó: 1 Shampoo neutro, 3 Hisopos (libre) · 15:42\n📝 clienta de laminado',
    );
    const largo = tituloEncuesta({
      nombre: 'Luna',
      items: [{ nombre: 'x'.repeat(150), cantidad: 1 }],
      nota: 'y'.repeat(300),
      creada,
    });
    expect(largo.length).toBe(255);
    expect(largo.endsWith('…')).toBe(true);
  });

  it('un voto confirma, anula o no dice nada', () => {
    expect(decisionDelVoto([OPCION_CONFIRMAR])).toBe(
      EstadoSolicitudStock.APROBADA,
    );
    expect(decisionDelVoto([OPCION_ANULAR])).toBe(
      EstadoSolicitudStock.RECHAZADA,
    );
    expect(decisionDelVoto([])).toBeNull();
    expect(decisionDelVoto([OPCION_CONFIRMAR, OPCION_ANULAR])).toBeNull();
    expect(decisionDelVoto(['otra cosa'])).toBeNull();
  });

  it('sólo votan los teléfonos autorizados, con o sin 54/9 adelante', () => {
    const votantes = ['5491155556666'];
    expect(votanteAutorizado('5491155556666', votantes)).toBe(true);
    expect(votanteAutorizado('+54 9 11 5555-6666', votantes)).toBe(true);
    expect(votanteAutorizado('1155556666', votantes)).toBe(true);
    expect(votanteAutorizado('5491144443333', votantes)).toBe(false);
    expect(votanteAutorizado('', votantes)).toBe(false);
    expect(votanteAutorizado('5491155556666', [])).toBe(false);
    expect(votanteAutorizado('5491144443333', ['*'])).toBe(true);
    expect(votanteAutorizado('', ['*'])).toBe(true);
  });
});
