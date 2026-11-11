import {
  armarLineas,
  armarResumen,
  coincideNombre,
  confirmacionObligatoria,
  detalleValidacion,
  etiquetaComandas,
  validarDia,
} from './resumen';

const CATS = [
  { id: 'b', nombre: 'Categoría B', orden: 2 },
  { id: 'a', nombre: 'Categoría A', orden: 1 },
  { id: 'c', nombre: 'Categoría C', orden: 3 },
];

describe('resumen de servicios del día para Ritmo', () => {
  it('valida el día', () => {
    expect(validarDia('2026-10-19')).toBe('2026-10-19');
    expect(() => validarDia('19/10/2026')).toThrow('AAAA-MM-DD');
    expect(() => validarDia('2026-02-30')).toThrow('no existe');
  });

  it('una línea por categoría en orden, en 0 las que no tuvieron nada, y "Sin categoría" sólo si hubo', () => {
    const lineas = armarLineas(CATS, [
      { categoriaId: 'a', cantidad: 3, validadas: 1 },
      { categoriaId: 'a', cantidad: 1, validadas: 1 },
      { categoriaId: null, cantidad: 2, validadas: 0 },
    ]);
    expect(lineas.map((l) => [l.label, l.count, l.detail])).toEqual([
      ['Categoría A', 4, '2 validadas'],
      ['Categoría B', 0, ''],
      ['Categoría C', 0, ''],
      ['Sin categoría', 2, 'sin validar'],
    ]);
    expect(armarLineas(CATS, []).map((l) => l.label)).toEqual([
      'Categoría A',
      'Categoría B',
      'Categoría C',
    ]);
  });

  it('el detalle cuenta lo validado', () => {
    expect(detalleValidacion(0, 0)).toBe('');
    expect(detalleValidacion(3, 0)).toBe('sin validar');
    expect(detalleValidacion(3, 1)).toBe('1 validada');
    expect(detalleValidacion(3, 3)).toBe('todas validadas');
    expect(detalleValidacion(1, 1)).toBe('validada');
  });

  it('arma el contrato de Ritmo con total, nota y confirmación', () => {
    const lineas = armarLineas(CATS, [
      { categoriaId: 'a', cantidad: 4, validadas: 4 },
      { categoriaId: 'b', cantidad: 1, validadas: 0 },
    ]);
    const sin = armarResumen({
      dia: '2026-10-19',
      lineas,
      comandas: 4,
      confirmacionObligatoria: true,
      confirmacion: null,
    });
    expect(sin.available).toBe(true);
    expect(sin.total).toBe(5);
    expect(sin.note).toMatch(/puede cambiar/);
    expect(sin.confirmation).toEqual({
      required: true,
      confirmedAt: null,
      agreed: null,
      note: null,
    });
    // Los productos van aunque sean 0: se ve que se cuentan.
    expect(sin.highlights).toEqual([
      { key: 'comandas', label: 'comandas', count: 4 },
      { key: 'productos', label: 'productos', count: 0 },
    ]);
    expect(
      armarResumen({
        dia: '2026-10-19',
        lineas,
        comandas: 1,
        productos: 1,
        confirmacionObligatoria: true,
        confirmacion: null,
      }).highlights,
    ).toEqual([
      { key: 'comandas', label: 'comanda', count: 1 },
      { key: 'productos', label: 'producto', count: 1 },
    ]);
    expect(sin.items[0]).toEqual({
      key: 'a',
      label: 'Categoría A',
      count: 4,
      detail: 'todas validadas',
    });

    const con = armarResumen({
      dia: '2026-10-19',
      lineas,
      comandas: 4,
      confirmacionObligatoria: false,
      confirmacion: {
        confirmadoEn: new Date('2026-10-19T21:00:00Z'),
        conforme: false,
        nota: 'hice 5 de A',
      },
    });
    expect(con.confirmation).toEqual({
      required: false,
      confirmedAt: '2026-10-19T21:00:00.000Z',
      agreed: false,
      note: 'hice 5 de A',
    });

    const vacio = armarResumen({
      dia: '2026-10-19',
      lineas: armarLineas(CATS, []),
      comandas: 0,
      confirmacionObligatoria: true,
      confirmacion: null,
    });
    expect(vacio.total).toBe(0);
    expect(vacio.note).toBeNull();
  });

  it('confirma obligatoria si está marcada o si ese día tuvo comandas', () => {
    expect(confirmacionObligatoria(true, 0)).toBe(true);
    expect(confirmacionObligatoria(false, 1)).toBe(true);
    expect(confirmacionObligatoria(false, 0)).toBe(false);
    expect(etiquetaComandas(1)).toBe('comanda');
    expect(etiquetaComandas(7)).toBe('comandas');
  });

  it('vincula por primer nombre, sin acentos, cuando no hay ritmoUserId', () => {
    expect(coincideNombre('Luna García', 'Luna')).toBe(true);
    expect(coincideNombre('Rosario Nauda', 'Rosario')).toBe(true);
    expect(coincideNombre('Mery García', 'Mery Garcia')).toBe(true);
    expect(coincideNombre('Karina Navarro', 'Luna')).toBe(false);
    expect(coincideNombre('', 'Luna')).toBe(false);
  });
});
