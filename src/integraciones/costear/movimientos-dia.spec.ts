import { armarMovimientos, validarDia } from './movimientos-dia';

describe('movimientos del día para Costear', () => {
  it('rechaza días mal escritos o inexistentes', () => {
    expect(() => validarDia('2026-02-30')).toThrow();
    expect(() => validarDia('hoy')).toThrow();
    expect(() => validarDia('2026-10-23')).not.toThrow();
  });

  it('arma comandas con pagos, ítems y total; sin pagos usa el precio', () => {
    const r = armarMovimientos(
      '2026-10-23',
      [
        {
          id: 'c1',
          numero: '01-0100',
          hora: '10:15',
          estado: 'VALIDADO',
          cliente: ' Ana  P ',
          creado_por: 'Ro',
          observaciones: '',
          precio_pesos: '50000',
          precio_dolar: '0',
        },
        {
          id: 'c2',
          numero: '01-0101',
          hora: '11:00',
          estado: 'PENDIENTE',
          cliente: null,
          creado_por: null,
          observaciones: null,
          precio_pesos: '30000.5',
          precio_dolar: '20',
        },
      ],
      [
        { comanda_id: 'c1', tipo: 'EFECTIVO', moneda: 'ARS', monto: '20000' },
        {
          comanda_id: 'c1',
          tipo: 'TRANSFERENCIA',
          moneda: 'ARS',
          monto: '30000',
        },
      ],
      [
        {
          comanda_id: 'c1',
          nombre: 'Cejas',
          cantidad: 1,
          subtotal: '50000',
          trabajador: 'Luna',
        },
      ],
      [
        {
          id: 's1',
          hora: '09:00',
          cliente: 'Bea',
          tipo_pago: null,
          moneda: 'ars',
          monto: '15000',
          estado: 'ACTIVO',
          observaciones: null,
          servicio: 'Lifting',
          turno: '2026-10-30',
        },
      ],
      [
        {
          id: 'e1',
          hora: '18:00',
          caja: 'caja_2',
          moneda: 'usd',
          monto: '100',
          numero: '02-0005',
          observaciones: 'Proveedor',
          creado_por: 'Mery',
          comanda_id: 'ce',
        },
      ],
      [
        {
          comanda_id: 'ce',
          nombre: 'Insumos',
          cantidad: 1,
          subtotal: null,
          trabajador: null,
        },
      ],
      new Date('2026-10-23T22:00:00Z'),
    );
    expect(r.comandas[0]).toMatchObject({
      cliente: 'Ana P',
      observaciones: null,
      total: { ARS: 50000, USD: 0 },
    });
    expect(r.comandas[0].items[0]).toEqual({
      nombre: 'Cejas',
      cantidad: 1,
      subtotal: 50000,
      trabajador: 'Luna',
    });
    expect(r.comandas[1].pagos).toEqual([
      { tipo: 'SIN_DETALLE', moneda: 'ARS', monto: 30000.5 },
      { tipo: 'SIN_DETALLE', moneda: 'USD', monto: 20 },
    ]);
    expect(r.senas[0]).toMatchObject({
      tipoPago: 'SIN_DETALLE',
      moneda: 'ARS',
      monto: 15000,
      turno: '2026-10-30',
    });
    expect(r.egresos[0]).toMatchObject({
      caja: 'caja_2',
      moneda: 'USD',
      monto: 100,
      conceptos: ['Insumos'],
    });
  });
});
