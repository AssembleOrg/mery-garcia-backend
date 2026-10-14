import { armarTotales, diasDelRango } from './caja-totales';

describe('totales de caja para Costear', () => {
  it('arma todos los días del rango, aunque no haya movimientos', () => {
    expect(diasDelRango('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('rechaza fechas mal escritas, inexistentes o al revés', () => {
    expect(() => diasDelRango('1/9/2026', '2026-09-30')).toThrow('AAAA-MM-DD');
    expect(() => diasDelRango('2026-02-30', '2026-03-01')).toThrow('no existe');
    expect(() => diasDelRango('2026-10-02', '2026-10-01')).toThrow('anterior');
    expect(() => diasDelRango('2025-01-01', '2026-12-31')).toThrow('400');
  });

  it('suma por día y en el total, separando ingresos, pendientes, señas y egresos', () => {
    const r = armarTotales(
      '2026-09-01',
      '2026-09-02',
      [
        {
          dia: '2026-09-01',
          bloque: 'ingresos',
          clave: 'EFECTIVO',
          moneda: 'ARS',
          monto: '1000.50',
        },
        {
          dia: '2026-09-02',
          bloque: 'ingresos',
          clave: 'EFECTIVO',
          moneda: 'ARS',
          monto: 499.5,
        },
        {
          dia: '2026-09-02',
          bloque: 'ingresos',
          clave: 'EFECTIVO',
          moneda: 'USD',
          monto: 20,
        },
        {
          dia: '2026-09-02',
          bloque: 'pendientes',
          clave: 'TARJETA',
          moneda: 'ARS',
          monto: 300,
        },
        {
          dia: '2026-09-01',
          bloque: 'senas',
          clave: 'TRANSFERENCIA',
          moneda: 'ARS',
          monto: 150,
        },
        {
          dia: '2026-09-02',
          bloque: 'egresos',
          clave: 'caja_1',
          moneda: 'ARS',
          monto: 80,
        },
        {
          dia: '2026-09-03',
          bloque: 'ingresos',
          clave: 'QR',
          moneda: 'ARS',
          monto: 999,
        }, // fuera de rango
        {
          dia: '2026-09-01',
          bloque: 'ingresos',
          clave: 'QR',
          moneda: 'EUR',
          monto: 5,
        }, // moneda desconocida
      ],
      [
        { dia: '2026-09-01', bloque: 'comandas', n: '2' },
        { dia: '2026-09-02', bloque: 'comandas', n: 1 },
        { dia: '2026-09-02', bloque: 'pendientes', n: 1 },
      ],
      new Date('2026-10-14T12:00:00Z'),
    );
    expect(r.totales.ingresos).toEqual({ EFECTIVO: { ARS: 1500, USD: 20 } });
    expect(r.totales.pendientes).toEqual({ TARJETA: { ARS: 300, USD: 0 } });
    expect(r.totales.senas).toEqual({ TRANSFERENCIA: { ARS: 150, USD: 0 } });
    expect(r.totales.egresos).toEqual({ caja_1: { ARS: 80, USD: 0 } });
    expect(r.totales.cantidad).toEqual({
      comandas: 3,
      pendientes: 1,
      senas: 0,
      egresos: 0,
    });
    expect(r.dias.map((d) => d.fecha)).toEqual(['2026-09-01', '2026-09-02']);
    expect(r.dias[0].ingresos).toEqual({ EFECTIVO: { ARS: 1000.5, USD: 0 } });
    expect(r.dias[1].pendientes.TARJETA.ARS).toBe(300);
  });
});
