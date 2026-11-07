import {
  comisionSobreSeña,
  NO_ASISTIO_SIN_CLIENTE,
  NO_ASISTIO_SIN_PAGOS,
  NO_ASISTIO_SIN_SENA,
  NO_ASISTIO_SIN_SERVICIO,
  NO_ASISTIO_SOLO_INGRESO,
  NO_ASISTIO_SOLO_SERVICIOS,
  problemaNoAsistio,
  repartirSeña,
} from './no-asistio';

const base = {
  esIngreso: true,
  clienteId: 'c1',
  consumeSeñaARS: true,
  consumeSeñaUSD: false,
  items: [{ trabajadorId: 't1', esProducto: false }],
  pagos: [] as number[],
};

describe('problemaNoAsistio', () => {
  it('servicio + seña + sin pagos: se puede guardar', () => {
    expect(problemaNoAsistio(base)).toBeNull();
    expect(problemaNoAsistio({ ...base, pagos: [0] })).toBeNull();
  });
  it.each([
    [{ esIngreso: false }, NO_ASISTIO_SOLO_INGRESO],
    [{ clienteId: null }, NO_ASISTIO_SIN_CLIENTE],
    [{ consumeSeñaARS: false }, NO_ASISTIO_SIN_SENA],
    [
      { items: [{ trabajadorId: 't1', esProducto: true }] },
      NO_ASISTIO_SOLO_SERVICIOS,
    ],
    [
      { items: [{ trabajadorId: null, esProducto: false }] },
      NO_ASISTIO_SIN_SERVICIO,
    ],
    [{ items: [] }, NO_ASISTIO_SIN_SERVICIO],
    [{ pagos: [5000] }, NO_ASISTIO_SIN_PAGOS],
  ])('%o → no', (cambio, error) => {
    expect(problemaNoAsistio({ ...base, ...cambio })).toBe(error);
  });
  it('seña solo en dólares también sirve', () => {
    expect(
      problemaNoAsistio({
        ...base,
        consumeSeñaARS: false,
        consumeSeñaUSD: true,
      }),
    ).toBeNull();
  });
});

describe('repartirSeña', () => {
  it('un servicio se lleva toda la seña', () => {
    expect(
      repartirSeña({ ARS: 200000, USD: 0 }, [
        { trabajadorId: 'ro', servicio: 'Lifting', subtotal: 95000 },
      ]),
    ).toEqual([
      { trabajadorId: 'ro', servicio: 'Lifting', moneda: 'ARS', seña: 200000 },
    ]);
  });
  it('varios servicios: en proporción al precio y suma exacta', () => {
    const p = repartirSeña({ ARS: 50000, USD: 0 }, [
      { trabajadorId: 'a', servicio: 'A', subtotal: 100 },
      { trabajadorId: 'b', servicio: 'B', subtotal: 200 },
    ]);
    expect(p.map((x) => x.seña)).toEqual([16666.67, 33333.33]);
    expect(p.reduce((s, x) => s + x.seña, 0)).toBeCloseTo(50000, 6);
  });
  it('sin precios: partes iguales; cada moneda por separado', () => {
    const p = repartirSeña({ ARS: 15000, USD: 100 }, [
      { trabajadorId: 'a', servicio: 'A', subtotal: 0 },
      { trabajadorId: 'b', servicio: 'B', subtotal: 0 },
    ]);
    expect(p).toEqual([
      { trabajadorId: 'a', servicio: 'A', moneda: 'ARS', seña: 7500 },
      { trabajadorId: 'b', servicio: 'B', moneda: 'ARS', seña: 7500 },
      { trabajadorId: 'a', servicio: 'A', moneda: 'USD', seña: 50 },
      { trabajadorId: 'b', servicio: 'B', moneda: 'USD', seña: 50 },
    ]);
  });
});

describe('comisionSobreSeña', () => {
  it('porcentaje del servicio sobre la seña', () => {
    expect(comisionSobreSeña(200000, 30)).toBe(60000);
    expect(comisionSobreSeña(50000, 25)).toBe(12500);
    expect(comisionSobreSeña(15000, 30)).toBe(4500);
  });
});
