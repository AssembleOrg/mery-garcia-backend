import { EstadoPedidoCompra as E } from './entities/PedidoCompra.entity';
import {
  bloqueado,
  claveNombre,
  editableHasta,
  faltaPara,
  fechasPara,
  limpiarNombre,
  totalCalculado,
} from './reglas';
import { ajusteParaContado, cantidadArticulo } from '../stock/cantidades-stock';

const H = 60 * 60 * 1000;

describe('compras: 48 h para editar desde que se compró', () => {
  const comprado = new Date('2026-11-07T15:00:00Z');

  it('sin comprar no hay límite', () => {
    expect(editableHasta(null)).toBeNull();
    expect(bloqueado(null, new Date('2030-01-01'))).toBe(false);
  });

  it('se edita hasta 48 h justas y después no', () => {
    expect(editableHasta(comprado)?.toISOString()).toBe(
      '2026-11-09T15:00:00.000Z',
    );
    expect(bloqueado(comprado, new Date(comprado.getTime() + 47 * H))).toBe(
      false,
    );
    expect(bloqueado(comprado, new Date(comprado.getTime() + 48 * H))).toBe(
      false,
    );
    expect(bloqueado(comprado, new Date(comprado.getTime() + 48 * H + 1))).toBe(
      true,
    );
  });
});

describe('compras: qué le falta a cada estado', () => {
  const base = { titulo: null, nota: null, proveedores: 0, items: 0 };

  it('una nota sola alcanza para anotar o pedir precio', () => {
    expect(
      faltaPara(E.ANOTADO, { ...base, nota: 'faltan hisopos' }),
    ).toBeNull();
    expect(faltaPara(E.PEDIR_PRECIO, { ...base, titulo: 'Café' })).toBeNull();
    expect(faltaPara(E.ANOTADO, base)).toMatch(
      /al menos un artículo o una nota/,
    );
    expect(faltaPara(E.ANOTADO, { ...base, nota: '   ' })).toMatch(/al menos/);
  });

  it('comprar o entregar pide artículos y al menos un proveedor', () => {
    expect(faltaPara(E.COMPRADO, { ...base, nota: 'x' })).toMatch(/artículos/);
    expect(faltaPara(E.COMPRADO, { ...base, items: 2 })).toMatch(/proveedor/);
    expect(faltaPara(E.ENTREGADO, { ...base, items: 2 })).toMatch(/proveedor/);
    expect(
      faltaPara(E.COMPRADO, { ...base, items: 2, proveedores: 1 }),
    ).toBeNull();
    expect(faltaPara(E.CANCELADO, { ...base, items: 1 })).toBeNull();
  });
});

describe('compras: fechas al cambiar de estado', () => {
  const ahora = new Date('2026-11-07T15:00:00Z');
  const antes = new Date('2026-11-06T10:00:00Z');

  it('comprar fija la fecha una sola vez', () => {
    expect(
      fechasPara(E.COMPRADO, { compradoAt: null, entregadoAt: null }, ahora),
    ).toEqual({
      compradoAt: ahora,
      entregadoAt: null,
    });
    expect(
      fechasPara(E.COMPRADO, { compradoAt: antes, entregadoAt: null }, ahora)
        .compradoAt,
    ).toBe(antes);
  });

  it('entregar sin haber marcado comprado cuenta como comprado ahora', () => {
    expect(
      fechasPara(E.ENTREGADO, { compradoAt: null, entregadoAt: null }, ahora),
    ).toEqual({
      compradoAt: ahora,
      entregadoAt: ahora,
    });
  });

  it('volver atrás borra las fechas; cancelar saca la entrega', () => {
    expect(
      fechasPara(E.ANOTADO, { compradoAt: antes, entregadoAt: antes }, ahora),
    ).toEqual({
      compradoAt: null,
      entregadoAt: null,
    });
    expect(
      fechasPara(E.CANCELADO, { compradoAt: antes, entregadoAt: antes }, ahora),
    ).toEqual({
      compradoAt: antes,
      entregadoAt: null,
    });
  });
});

describe('compras: totales y nombres', () => {
  it('suma sólo lo que tiene precio, sin errores de coma', () => {
    expect(totalCalculado([])).toBeNull();
    expect(totalCalculado([{ cantidad: 3, precioUnitario: null }])).toBeNull();
    expect(
      totalCalculado([
        { cantidad: 3, precioUnitario: 0.1 },
        { cantidad: 2, precioUnitario: 1500.5 },
        { cantidad: 9, precioUnitario: null },
      ]),
    ).toBe(3001.3);
  });

  it('compara nombres sin espacios de más, mayúsculas ni tildes', () => {
    expect(limpiarNombre('  Hisopos   largos ')).toBe('Hisopos largos');
    expect(claveNombre('Epítesis  CAP')).toBe(claveNombre('epitesis cap'));
  });
});

describe('stock por cantidades', () => {
  it('sin entradas ni conteo no se lleva la cuenta', () => {
    expect(
      cantidadArticulo(
        { entradas: 0, usado: 4, ajustes: 0, controla: false },
        null,
      ),
    ).toEqual({
      cantidad: null,
      bajo: false,
    });
  });

  it('llegó − usado + ajustes; avisa con 1 o 0', () => {
    expect(
      cantidadArticulo(
        { entradas: 10, usado: 3, ajustes: -1, controla: true },
        null,
      ),
    ).toEqual({
      cantidad: 6,
      bajo: false,
    });
    expect(
      cantidadArticulo(
        { entradas: 2, usado: 1, ajustes: 0, controla: true },
        null,
      ).bajo,
    ).toBe(true);
    expect(
      cantidadArticulo(
        { entradas: 2, usado: 2, ajustes: 0, controla: true },
        null,
      ).bajo,
    ).toBe(true);
  });

  it('con mínimo avisa al llegar al mínimo', () => {
    const m = { entradas: 10, usado: 5, ajustes: 0, controla: true };
    expect(cantidadArticulo(m, 5).bajo).toBe(true);
    expect(cantidadArticulo(m, 4).bajo).toBe(false);
    // Un mínimo de 0 no apaga el aviso de la última unidad.
    expect(cantidadArticulo({ ...m, usado: 9 }, 0).bajo).toBe(true);
  });

  it('el conteo deja justo lo contado aunque antes se hayan usado', () => {
    const m = { entradas: 0, usado: 3, ajustes: 0, controla: false };
    const ajuste = ajusteParaContado(m, 7);
    expect(ajuste).toBe(10);
    expect(
      cantidadArticulo({ ...m, ajustes: ajuste, controla: true }, null)
        .cantidad,
    ).toBe(7);
  });
});
