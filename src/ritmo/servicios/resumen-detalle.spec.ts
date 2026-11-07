import { lineaComision, LineaComision } from 'src/comanda/comisiones/detalle';
import { armarGanancia, armarSecciones } from './resumen-detalle';

const base = {
  comandaId: 'c1',
  numero: '01-11300',
  dia: '2026-11-05',
  cliente: 'Ana Pérez',
  validada: true,
  categoria: 'Categoría A',
  cantidad: 1,
  moneda: 'ARS' as const,
  porcentajeMax: 35,
  confirmado: false,
  esquemaBase: true,
  nota: null,
};
const l = (
  x: Partial<LineaComision> &
    Pick<LineaComision, 'tipo' | 'item' | 'hora' | 'base' | 'porcentaje'>,
) => lineaComision({ ...base, ...x });

const detalle = [
  l({
    tipo: 'SERVICIO',
    item: 'Laminado',
    hora: '15:10',
    base: 40000,
    porcentaje: 30,
    numero: '01-2',
  }),
  l({
    tipo: 'SERVICIO',
    item: 'Tinte de cejas',
    hora: '11:00',
    base: 30000,
    porcentaje: 30,
    categoria: 'Categoría B',
    validada: false,
    numero: '01-1',
  }),
  l({
    tipo: 'NO_ASISTIO',
    item: 'Lifting',
    hora: '17:00',
    base: 200000,
    porcentaje: 30,
    cliente: 'Sol',
  }),
  l({
    tipo: 'PRODUCTO',
    item: 'Crema',
    hora: '15:10',
    base: 20000,
    porcentaje: 5,
    cantidad: 2,
    categoria: null,
  }),
  l({
    tipo: 'SERVICIO',
    item: 'Consulta',
    hora: '16:00',
    base: 0,
    porcentaje: 0,
    nota: 'sin base cargada',
    categoria: null,
  }),
];

describe('armarSecciones', () => {
  it('servicios por hora, con categoría, clienta y comisión; no-shows y productos aparte', () => {
    const s = armarSecciones(detalle, true);
    expect(s.map((x) => x.key)).toEqual([
      'servicios',
      'no-asistio',
      'productos',
    ]);
    const servicios = s[0].lines;
    expect(servicios.map((x) => x.label)).toEqual([
      'Tinte de cejas',
      'Laminado',
      'Consulta',
    ]);
    expect(servicios[0]).toMatchObject({
      detail: 'Categoría B · Ana Pérez · 11:00',
      badge: 'sin validar',
      amount: { currency: 'ARS', value: 9000 },
      amountDetail: '$ 30.000 × 30%',
    });
    expect(servicios[1].badge).toBeNull();
    expect(servicios[2]).toMatchObject({
      amount: null,
      amountDetail: 'sin base cargada',
    });
    expect(s[1].lines[0]).toMatchObject({
      label: 'Lifting',
      detail: 'Sol · 17:00',
      badge: 'No se presentó',
      tone: 'warning',
      amount: { currency: 'ARS', value: 60000 },
      amountDetail: 'seña $ 200.000 × 30%',
    });
    expect(s[2].lines[0]).toMatchObject({
      label: 'Crema ×2',
      tone: 'muted',
      amount: { value: 1000 },
    });
  });

  it('sin plata (cálculo histórico): el listado va igual, sin montos', () => {
    const s = armarSecciones(detalle, false);
    expect(s[0].lines[0]).toMatchObject({ amount: null, amountDetail: null });
    expect(s[0].lines[2].amountDetail).toBe('sin base cargada');
  });

  it('día sin nada: sin secciones', () => {
    expect(armarSecciones([], true)).toEqual([]);
  });
});

describe('armarGanancia', () => {
  it('% sin confirmar: total al mínimo y hasta cuánto daría', () => {
    const g = armarGanancia({
      totalARS: 70000,
      totalUSD: 0,
      totalARSAlMaximo: 81000,
      porcentajePendiente: true,
      detalle,
    });
    expect(g.amounts).toEqual([{ currency: 'ARS', value: 70000 }]);
    expect(g.detail).toBe(
      'Calculada al 30%: el % del mes se confirma al cierre. Al máximo serían $ 81.000.',
    );
  });
  it('% confirmado y dólares', () => {
    const conf = detalle.map((x) => ({
      ...x,
      confirmado: true,
      porcentaje: x.porcentaje === 30 ? 32 : x.porcentaje,
    }));
    const g = armarGanancia({
      totalARS: 1000,
      totalUSD: 15,
      totalARSAlMaximo: 1000,
      porcentajePendiente: false,
      detalle: conf,
    });
    expect(g.amounts).toEqual([
      { currency: 'ARS', value: 1000 },
      { currency: 'USD', value: 15 },
    ]);
    expect(g.detail).toBe(
      'Al 32%. Incluye lo que todavía no está validado en caja.',
    );
  });
});
