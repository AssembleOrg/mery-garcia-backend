import { esVarianteLista, factorEfectivo, nombreBase, porcentajeDelMes, ProductoCatalogo, EsquemaTrabajadora } from './reglas';

const p = (id: string, nombre: string, precio: number, fijo = 0, cong = false): ProductoCatalogo => ({
  id,
  nombre,
  tipo: 'PRODUCTO',
  precio,
  precioFijoARS: fijo,
  esPrecioCongelado: cong,
  unidadNegocioId: 'prod',
});

// Nombres tal cual están en el catálogo de producción.
const catalogo = [
  p('1', 'TINTES brow daddy precio lista DB', 57),
  p('2', 'TINTES brow daddy efectivo DB', 48),
  p('3', 'after care brow daddy  precio lista', 36),
  p('4', 'after care brow daddy efect', 30),
  p('5', 'Stick Solar precio lista', 27.18, 42000, true),
  p('6', 'Stick Solar EFEC', 22.65, 35000, true),
  p('7', 'RefectoCil Care Balm Night TARJETA', 28.84, 38500, true),
  p('8', 'RefectoCil Care Balm Night EFEC Y TRANSF', 26.22, 35000, true),
  p('9', 'Agua Micelar TARJETA', 17.6, 23500, true),
  p('10', 'Agua Micelar EFECT Y TRANSF', 14.23, 19000, true),
  p('11', 'BLUSH classy precio lista #2', 27.1, 42000, true),
  p('12', 'BLUSH classy efectivo #2', 22.58, 35000, true),
  p('13', 'KIT PINZAS precio lista', 50),
  p('14', 'ONE TO ONE mery', 500),
];

describe('reglas de comisión', () => {
  it('normaliza el nombre sin la variante de precio', () => {
    expect(nombreBase('TINTES brow daddy precio lista DB')).toBe('tintes brow daddy db');
    expect(nombreBase('TINTES brow daddy efectivo DB')).toBe('tintes brow daddy db');
    expect(nombreBase('Agua Micelar EFECT Y TRANSF')).toBe('agua micelar');
    expect(nombreBase('RefectoCil Care Balm Night EFEC Y TRANSF')).toBe('refectocil care balm night');
  });

  it('distingue lista de efectivo', () => {
    expect(esVarianteLista('Stick Solar precio lista')).toBe(true);
    expect(esVarianteLista('Agua Micelar TARJETA')).toBe(true);
    expect(esVarianteLista('Stick Solar EFEC')).toBe(false);
    expect(esVarianteLista('ONE TO ONE mery')).toBe(false);
  });

  it('lleva la variante lista al precio en efectivo de su gemela', () => {
    expect(factorEfectivo(catalogo[0], catalogo)).toBeCloseTo(48 / 57);
    expect(factorEfectivo(catalogo[2], catalogo)).toBeCloseTo(30 / 36);
    expect(factorEfectivo(catalogo[4], catalogo)).toBeCloseTo(35000 / 42000);
    expect(factorEfectivo(catalogo[6], catalogo)).toBeCloseTo(35000 / 38500);
    expect(factorEfectivo(catalogo[8], catalogo)).toBeCloseTo(19000 / 23500);
    expect(factorEfectivo(catalogo[10], catalogo)).toBeCloseTo(35000 / 42000);
  });

  it('no ajusta lo que ya es efectivo ni lo que no tiene gemela', () => {
    expect(factorEfectivo(catalogo[1], catalogo)).toBe(1);
    expect(factorEfectivo(catalogo[12], catalogo)).toBe(1); // KIT PINZAS lista sin gemela efectivo en este catálogo
    expect(factorEfectivo(catalogo[13], catalogo)).toBe(1);
  });

  it('usa el porcentaje confirmado del mes o, si no hay, el mínimo del rango', () => {
    const esq: EsquemaTrabajadora = {
      porcentajeMin: 30,
      porcentajeMax: 35,
      productosPorcentaje: 5,
      desde: '2026-10-01',
      bases: new Map(),
      confirmados: new Map([['2026-10', 32]]),
    };
    expect(porcentajeDelMes(esq, '2026-10')).toEqual({ aplicado: 32, maximo: 32, confirmado: true });
    expect(porcentajeDelMes(esq, '2026-11')).toEqual({ aplicado: 30, maximo: 35, confirmado: false });
  });
});
