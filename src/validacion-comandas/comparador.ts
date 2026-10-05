import type { LecturaComanda } from './lector-ia.service';

/**
 * Compara lo que dice el papel (leído por la IA) contra la comanda del sistema.
 * Reglas fijas, sin IA: son las que dieron 32/40 comandas OK y las 5
 * diferencias reales detectadas en la prueba con las comandas del 18 al 22/8.
 * Reflejan cómo se completa el papel en la práctica (pagos en OTROS, "consulta"
 * escrito sobre otra fila, "debemos $X", etc.).
 */

export interface ComandaSistema {
  id: string;
  numero: string;
  fecha: string; // AAAA-MM-DD (hora de Argentina)
  estado: string;
  cliente: string | null;
  observaciones: string | null;
  items: {
    nombre: string;
    trabajador: string | null;
    cantidad?: number;
    subtotal?: number;
  }[];
  pagos: { tipo: string; moneda: string; monto: number }[];
  senas: { moneda: string; monto: number; tipoPago?: string }[];
  /** Sólo para mostrar el gemelo digital: */
  precioPesos?: number;
  precioDolar?: number;
  cargadaPor?: string | null;
}

export type CampoDiferencia =
  | 'fecha'
  | 'cliente'
  | 'servicios'
  | 'responsables'
  | 'sena'
  | 'cobrado'
  | 'anulada';

export interface Diferencia {
  campo: CampoDiferencia;
  papel: string;
  sistema: string;
}

/** "011089" (papel) → "01-11089" (sistema). La serie 01 es la de ingresos. */
export function numeroSistema(
  numeroPapel: string | null | undefined,
): string | null {
  const d = (numeroPapel ?? '').replace(/\D/g, '');
  return d ? `01-${parseInt(d, 10)}` : null;
}

export function norm(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** Parecido entre dos textos (Ratcliff/Obershelp, como SequenceMatcher de Python). */
export function parecido(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const x = norm(a),
    y = norm(b);
  if (!x || !y) return 0;
  const coinc = (s: string, t: string): number => {
    let mejor = 0,
      is = 0,
      it = 0;
    const prev = new Array<number>(t.length + 1).fill(0);
    for (let i = 1; i <= s.length; i++) {
      let diag = 0;
      for (let j = 1; j <= t.length; j++) {
        const tmp = prev[j];
        prev[j] = s[i - 1] === t[j - 1] ? diag + 1 : 0;
        if (prev[j] > mejor) {
          mejor = prev[j];
          is = i - mejor;
          it = j - mejor;
        }
        diag = tmp;
      }
    }
    if (!mejor) return 0;
    return (
      mejor +
      coinc(s.slice(0, is), t.slice(0, it)) +
      coinc(s.slice(is + mejor), t.slice(it + mejor))
    );
  };
  return (2 * coinc(x, y)) / (x.length + y.length);
}

const FILAS: [string, string][] = [
  ['modelado mery', 'modelado mery'],
  ['modelado', 'modelado'],
  ['tinte de cejas', 'tinte cejas'],
  ['laminado', 'laminado'],
  ['refill', 'refill'],
  ['lifting', 'lifting'],
  ['tinte de pestanas', 'tinte pestanas'],
  ['nanoblading 1ra', 'nano'],
  ['nanoblading retoque', 'nano retoque'],
  ['nanoblading mantenimiento', 'nano mant'],
  ['lip blush', 'lip blush'],
  ['lashes line', 'lashes line'],
  ['camuflaje', 'camuflaje'],
];
/** Prefijo del nombre del ítem en el sistema → categoría comparable con la fila del papel. */
const SISTEMA: [string, string][] = [
  ['modelado de cejas by mery', 'modelado mery'],
  ['modelado de cejas', 'modelado'],
  ['tinte de cejas', 'tinte cejas'],
  ['laminado de cejas', 'laminado'],
  ['refill de lashes', 'refill lashes'],
  ['refill', 'refill'],
  ['lifting', 'lifting'],
  ['tinte de pestanas', 'tinte pestanas'],
  ['nanoblading retoque', 'nano retoque'],
  ['nanoblading mant', 'nano mant'],
  ['nanoblading', 'nano'],
  ['lip blush', 'lip blush'],
  ['lashes line', 'lashes line'],
  ['camuflaje', 'camuflaje'],
  ['consulta', 'consulta'],
  ['solo insumos', 'solo insumos'],
  ['prueba alergia', 'prueba'],
  ['tintes brow daddy', 'producto'],
  ['after care', 'producto'],
];
const PRODUCTO = /\b(brow|daddy|bd|after|care|stain|serum|producto)\b/;
const RESP: Record<string, string> = {
  ro: 'rosario',
  rosario: 'rosario',
  luna: 'luna',
  lu: 'luna',
  mery: 'mery garcia',
  mica: 'mica',
};

/** Categoría de una fila marcada; lo escrito encima manda (p. ej. "consulta" sobre CAMUFLAJE). */
function catPapel(s: { fila: string; anotacion: string | null }): string {
  const a = norm(s.anotacion);
  if (a.includes('consulta')) return 'consulta';
  if (
    a.split(' ').includes('ins') ||
    a.includes('insumos') ||
    a.includes('solo ins')
  )
    return 'solo insumos';
  const f = norm(s.fila);
  for (const [k, c] of FILAS) if (f.startsWith(k)) return c;
  return 'otro:' + f;
}

function catSistema(nombre: string): string {
  const n = norm(nombre);
  for (const [k, c] of SISTEMA) if (n.startsWith(k)) return c;
  return 'otro:' + n;
}

function catResps(r: string | null): Set<string> {
  const out = new Set<string>();
  for (const p of (r ?? '').toLowerCase().split(/\s*(?:\/|,|&|\by\b)\s*/)) {
    const n = norm(p);
    if (n) out.add(RESP[n.split(' ')[0]] ?? n.split(' ')[0]);
  }
  return out;
}

const fmt = (n: number, moneda: string) =>
  `${moneda === 'USD' ? 'US$' : '$'} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}`;
const fmtTotales = (t: Record<string, number>) =>
  Object.keys(t).length
    ? Object.entries(t)
        .map(([m, v]) => fmt(v, m))
        .join(' · ')
    : '—';
const fmtFecha = (d: string) => d.split('-').reverse().join('/');
const titulo = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function comparar(
  L: LecturaComanda,
  S: ComandaSistema,
  fechaLote: string,
): Diferencia[] {
  const difs: Diferencia[] = [];

  // Fecha: la del lote (un PDF por día). La escrita a mano se lee mal muy seguido.
  if (S.fecha !== fechaLote) {
    difs.push({
      campo: 'fecha',
      papel: `Lote del ${fmtFecha(fechaLote)}`,
      sistema: fmtFecha(S.fecha),
    });
  }

  if (parecido(L.cliente, S.cliente) < 0.6) {
    difs.push({
      campo: 'cliente',
      papel: L.cliente ?? '(no se lee)',
      sistema: S.cliente ?? '(sin clienta)',
    });
  }

  const obsSis = norm(S.observaciones);
  if (L.anulada) {
    const anuladaSis =
      ['error', 'descart', 'anul', 'no vino'].some((w) => obsSis.includes(w)) ||
      S.estado === 'CANCELADA';
    if (!anuladaSis) {
      difs.push({
        campo: 'anulada',
        papel: 'Dice que se anuló / no vino',
        sistema: `Estado ${S.estado}, sin nota de anulación`,
      });
    }
  } else {
    const servicios = L.servicios ?? [];
    const otros = L.otros ?? [];
    const pap = new Set(servicios.map(catPapel));
    if (otros.some((o) => PRODUCTO.test(norm(o)))) pap.add('producto');
    for (const o of otros) {
      const n = norm(o);
      if (!PRODUCTO.test(n) && !n.includes('consulta')) pap.add('otro:' + n);
    }
    if (otros.some((o) => norm(o).includes('consulta'))) pap.add('consulta');
    const sis = new Set(S.items.map((i) => catSistema(i.nombre)));
    // "Consulta previa" en el sistema suele ser un ítem de $1 que el papel no anota: no se exige.
    const sisCmp = new Set(
      [...sis].filter(
        (x) =>
          (pap.has('consulta') || x !== 'consulta') && !x.startsWith('otro:'),
      ),
    );
    const papCmp = new Set([...pap].filter((x) => !x.startsWith('otro:')));
    const iguales =
      papCmp.size === sisCmp.size && [...papCmp].every((x) => sisCmp.has(x));
    if (!iguales) {
      const papel = [
        ...servicios.map(
          (s) =>
            titulo(s.fila) +
            (s.anotacion ? ` ("${s.anotacion}")` : '') +
            (s.responsable ? ` — ${s.responsable}` : ''),
        ),
        ...otros.map((o) => `Otros: ${o}`),
      ];
      difs.push({
        campo: 'servicios',
        papel: papel.join(' · ') || '(ningún servicio marcado)',
        sistema:
          S.items
            .map(
              (i) => `${i.nombre}${i.trabajador ? ` — ${i.trabajador}` : ''}`,
            )
            .join(' · ') || '(sin ítems)',
      });
    }

    const rp = new Set<string>();
    for (const s of servicios)
      if (s.responsable) for (const r of catResps(s.responsable)) rp.add(r);
    const primeros = new Set(
      S.items
        .flatMap((i) =>
          i.trabajador ? [norm(i.trabajador).split(' ')[0]] : [],
        )
        .filter(Boolean),
    );
    const rs = new Set([...primeros].map((x) => RESP[x] ?? x));
    if (primeros.has('mery')) rs.add('mery garcia');
    if (rp.size) {
      const alguna = [...rp].some((x) => rs.has(x));
      const contenidas = [...rp].every((x) => rs.has(x));
      if (!(alguna && (contenidas || rp.size > rs.size))) {
        difs.push({
          campo: 'responsables',
          papel: [
            ...new Set(
              servicios.flatMap((s) => (s.responsable ? [s.responsable] : [])),
            ),
          ].join(', '),
          sistema:
            [
              ...new Set(
                S.items.flatMap((i) => (i.trabajador ? [i.trabajador] : [])),
              ),
            ].join(', ') || '—',
        });
      }
    }
  }

  // Dinero
  const montos = (L.montos ?? []).filter((m) => m.monto);
  const senas = montos.filter((m) => m.donde === 'SENA' && !m.etiquetaTachada);
  const clave = (moneda: string | null, monto: number) =>
    `${moneda ?? 'ARS'}|${monto}`;
  const senasPap = senas.map((m) => clave(m.moneda, m.monto!)).sort();
  const senasSis = S.senas.map((s) => clave(s.moneda, s.monto)).sort();
  if (
    (senasPap.length || senasSis.length) &&
    senasPap.join(',') !== senasSis.join(',')
  ) {
    difs.push({
      campo: 'sena',
      papel:
        senas.map((m) => fmt(m.monto!, m.moneda ?? 'ARS')).join(' · ') ||
        '(no figura)',
      sistema:
        S.senas.map((s) => fmt(s.monto, s.moneda)).join(' · ') ||
        '(no usó seña)',
    });
  }

  // Lo cobrado: todo monto que no sea seña usada ni seña para el próximo turno (salvo etiqueta tachada).
  const esCobro = (m: (typeof montos)[number]) => {
    const t = norm(m.texto);
    if (/\b(debemos|debe|adeuda|falta)\b/.test(t)) return false; // saldo pendiente, no cobro
    if (m.donde === 'SENA_PROXIMO' && !m.etiquetaTachada)
      return t.includes('pag'); // "PAGÓ 250 USD" en esa fila
    return true;
  };
  let cobros = montos.filter((m) => !senas.includes(m) && esCobro(m));
  // Un "Pagó $X" en observaciones repite el saldo ya anotado: se descarta el duplicado exacto.
  const fuera = cobros.filter((m) => m.donde !== 'OBSERVACIONES');
  cobros = [
    ...fuera,
    ...cobros.filter(
      (m) =>
        m.donde === 'OBSERVACIONES' && !fuera.some((f) => f.monto === m.monto),
    ),
  ];
  const papPag: Record<string, number> = {};
  for (const m of cobros)
    papPag[m.moneda ?? 'ARS'] = (papPag[m.moneda ?? 'ARS'] ?? 0) + m.monto!;
  const sisPag: Record<string, number> = {};
  for (const p of S.pagos) {
    if (p.tipo === 'GIFT_CARD' && p.monto <= 1) continue; // gift card de $1: marca técnica, no cobro
    sisPag[p.moneda] = (sisPag[p.moneda] ?? 0) + p.monto;
  }
  const monedas = new Set([...Object.keys(papPag), ...Object.keys(sisPag)]);
  if (
    monedas.size &&
    ![...monedas].every(
      (k) => Math.abs((papPag[k] ?? 0) - (sisPag[k] ?? 0)) < 1,
    )
  ) {
    difs.push({
      campo: 'cobrado',
      papel: fmtTotales(papPag),
      sistema: fmtTotales(sisPag),
    });
  }
  return difs;
}
