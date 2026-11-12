import {
  aplicarCierre,
  Cierre,
  CIERRES,
  cierreEn,
  cierreParaAvisar,
  textoCierre,
} from './cierres';

/** Mediodía en Argentina (UTC-3) de esa fecha. */
const ar = (fecha: string, hora = '12:00') =>
  new Date(`${fecha}T${hora}:00-03:00`);
const VERANO: Cierre = {
  desde: '2026-12-31',
  hasta: '2027-01-11',
  motivo: 'por vacaciones',
};

describe('cierres', () => {
  it('el cierre de verano 2026/27 está cargado', () => {
    expect(CIERRES).toContainEqual(VERANO);
  });

  it('cierreEn: incluye el primer y el último día, en hora argentina', () => {
    expect(cierreEn(ar('2026-12-30', '23:59'), [VERANO])).toBeNull();
    expect(cierreEn(ar('2026-12-31', '00:01'), [VERANO])).toEqual(VERANO);
    expect(cierreEn(ar('2027-01-11', '23:00'), [VERANO])).toEqual(VERANO);
    expect(cierreEn(ar('2027-01-12', '00:30'), [VERANO])).toBeNull();
    // 12/1 01:00 UTC todavía es 11/1 en Argentina.
    expect(cierreEn(new Date('2027-01-12T01:00:00Z'), [VERANO])).toEqual(
      VERANO,
    );
  });

  it('avisa desde 60 días antes hasta el último día', () => {
    expect(cierreParaAvisar(ar('2026-10-31'), [VERANO])).toBeNull();
    expect(cierreParaAvisar(ar('2026-11-13'), [VERANO])).toEqual(VERANO);
    expect(cierreParaAvisar(ar('2027-01-11'), [VERANO])).toEqual(VERANO);
    expect(cierreParaAvisar(ar('2027-01-12'), [VERANO])).toBeNull();
  });

  it('texto antes y durante el cierre', () => {
    expect(textoCierre(VERANO, ar('2026-11-13'))).toBe(
      'Cerramos por vacaciones del jueves 31/12 al lunes 11/1 inclusive. Volvemos el martes 12/1 💖',
    );
    expect(textoCierre(VERANO, ar('2027-01-05'))).toBe(
      'Estamos cerradas por vacaciones hasta el lunes 11/1 inclusive. Volvemos el martes 12/1 💖',
    );
  });

  it('un cierre de un solo día', () => {
    expect(
      textoCierre(
        { desde: '2026-10-10', hasta: '2026-10-10', motivo: 'por excepción' },
        ar('2026-10-01'),
      ),
    ).toBe(
      'Cerramos por excepción el sábado 10/10. Volvemos el martes 13/10 💖',
    );
  });

  it('{cierre}: aviso si corresponde, y si no se va sin dejar renglones vacíos', () => {
    const texto = 'Nuestro horario es tal.\n\n{cierre}\n\nReservás en la web.';
    expect(aplicarCierre(texto, ar('2026-11-13'), [VERANO])).toBe(
      'Nuestro horario es tal.\n\n📌 Cerramos por vacaciones del jueves 31/12 al lunes 11/1 inclusive. Volvemos el martes 12/1 💖\n\nReservás en la web.',
    );
    expect(aplicarCierre(texto, ar('2027-02-01'), [VERANO])).toBe(
      'Nuestro horario es tal.\n\nReservás en la web.',
    );
    expect(aplicarCierre('Hola {cierre}', ar('2027-02-01'), [VERANO])).toBe(
      'Hola',
    );
    expect(aplicarCierre('Sin marcador', ar('2026-11-13'), [VERANO])).toBe(
      'Sin marcador',
    );
  });
});
