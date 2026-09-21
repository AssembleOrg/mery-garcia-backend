/**
 * Reduce un nombre de servicio a "tokens" canónicos, para poder comparar lo
 * que la clienta reservó (nombre de booking, a veces un combo) con lo que se
 * hizo (los items sueltos de la comanda del local, con nombres variados).
 *
 * Es un heurístico deliberadamente simple: cada palabra clave conocida suma un
 * token. Un combo ("Laminado + Modelado de cejas + Brow Refill") da varios
 * tokens; un item suelto ("Modelado de Cejas") da uno. Se compara el conjunto.
 *
 * No pretende ser perfecto: es la primera versión que pediste, y se afina
 * agregando reglas acá sin tocar el resto.
 */

/** Reglas keyword → token. El orden importa: las más específicas primero. */
const REGLAS: { re: RegExp; token: string }[] = [
  // Cosmetic tattoo
  { re: /nanoblading|nano blading/, token: 'NANOBLADING' },
  { re: /nano ?scalp/, token: 'NANO_SCALP' },
  { re: /lip ?blush/, token: 'LIP_BLUSH' },
  { re: /lip ?camoufl|camufl\w* de labios/, token: 'LIP_CAMOUFLAGE' },
  { re: /lash ?camoufl/, token: 'LASH_CAMOUFLAGE' },
  { re: /brow ?camoufl|camufl\w* de cejas|camuflaje/, token: 'BROW_CAMOUFLAGE' },
  { re: /lashes? ?line|lash ?line/, token: 'LASHES_LINE' },
  { re: /areola/, token: 'AREOLA' },
  { re: /scar ?camoufl|camufl\w* de cicatr/, token: 'SCAR' },
  { re: /freckles|pecas|beauty ?mark/, token: 'PECAS' },
  // Estilismo
  { re: /lash ?refill|refill de lashes|refill de pesta/, token: 'LASH_REFILL' },
  { re: /brow ?refill|refill/, token: 'REFILL' },
  { re: /laminado/, token: 'LAMINADO' },
  { re: /modelado|perfilado|dise[ñn]o de cejas/, token: 'MODELADO' },
  { re: /tinte de pesta/, token: 'TINTE_PESTANAS' },
  { re: /tinte/, token: 'TINTE_CEJAS' },
];

/** Etiqueta legible de cada token (para el reporte). */
export const ETIQUETA_TOKEN: Record<string, string> = {
  NANOBLADING: 'Nanoblading',
  NANO_SCALP: 'Nano Scalp',
  LIP_BLUSH: 'Lip Blush',
  LIP_CAMOUFLAGE: 'Lip Camouflage',
  LASH_CAMOUFLAGE: 'Lash Camouflage',
  BROW_CAMOUFLAGE: 'Camuflaje de cejas',
  LASHES_LINE: 'Lashes Line',
  AREOLA: 'Areola',
  SCAR: 'Camuflaje de cicatriz',
  PECAS: 'Pecas',
  LASH_REFILL: 'Refill de pestañas',
  REFILL: 'Brow Refill',
  LAMINADO: 'Laminado',
  MODELADO: 'Modelado de cejas',
  TINTE_PESTANAS: 'Tinte de pestañas',
  TINTE_CEJAS: 'Tinte de cejas',
  CONSULTA: 'Consulta',
};

export function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** ¿El nombre es una consulta (previa/obligatoria/opcional)? */
export function esConsulta(nombre: string): boolean {
  return /consulta/.test(normalizar(nombre));
}

/**
 * Tokens de servicio de un nombre. Una consulta suma además el token CONSULTA
 * (para distinguir "reservó la consulta" de "reservó el trabajo").
 */
export function tokensDeServicio(nombre: string): Set<string> {
  const t = normalizar(nombre);
  const tokens = new Set<string>();
  for (const { re, token } of REGLAS) {
    if (re.test(t)) tokens.add(token);
  }
  // Desambiguar pares donde la regla genérica pisa a la específica:
  // "Refill de Lashes"/"Tinte de Pestañas" no deben contar además como el de cejas.
  if (tokens.has('LASH_REFILL')) tokens.delete('REFILL');
  if (tokens.has('TINTE_PESTANAS')) tokens.delete('TINTE_CEJAS');
  if (esConsulta(nombre)) tokens.add('CONSULTA');
  return tokens;
}

/** Une los tokens de varios servicios (los items de una comanda). */
export function tokensDeVarios(nombres: string[]): Set<string> {
  const todos = new Set<string>();
  for (const n of nombres) for (const tk of tokensDeServicio(n)) todos.add(tk);
  return todos;
}

export type Coincidencia = 'COINCIDE' | 'PARCIAL' | 'DISTINTO' | 'INDETERMINADO';

/**
 * Compara lo reservado con lo tomado.
 *  - COINCIDE: todo lo reservado está entre lo que se hizo.
 *  - PARCIAL: se hizo parte de lo reservado (y/o algo más).
 *  - DISTINTO: no se hizo nada de lo reservado (cambió de servicio).
 *  - INDETERMINADO: no se pudo reconocer el servicio reservado.
 */
export function compararServicio(reservado: string, tomados: string[]): Coincidencia {
  return compararServicios([reservado], tomados);
}

/**
 * Igual que compararServicio pero con varios servicios reservados (la seña
 * puede apuntar a más de uno). Coincide si TODO lo reservado se hizo; parcial
 * si se hizo una parte; distinto si nada.
 */
export function compararServicios(reservados: string[], tomados: string[]): Coincidencia {
  const r = tokensDeVarios(reservados);
  r.delete('CONSULTA'); // la consulta no define la coincidencia del trabajo
  if (r.size === 0) return 'INDETERMINADO';
  const hechos = tokensDeVarios(tomados);
  hechos.delete('CONSULTA');
  const enComun = [...r].filter((tk) => hechos.has(tk));
  if (enComun.length === 0) return 'DISTINTO';
  if (enComun.length === r.size) return 'COINCIDE';
  return 'PARCIAL';
}
