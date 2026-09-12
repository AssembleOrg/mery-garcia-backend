/**
 * Defensas deterministas que corren ANTES del modelo.
 *
 * 1. Rate limit por contacto: frena spam y cuida el costo del clasificador.
 * 2. Recorte de entrada: un mensaje gigante no llega entero al modelo.
 * 3. Pedido de persona: se detecta acá, sin modelo, y va directo al equipo.
 * 4. Ataques (jailbreak / exfiltración): ni se clasifican; la charla pasa a
 *    una persona y el texto no se le muestra al modelo.
 *
 * El modelo, además, no escribe nada hacia la clienta: elige una clave. Aunque
 * lo engañaran, lo peor que puede hacer es elegir mal una respuesta de Mery.
 */

const VENTANA_MS = 60_000;
const MAX_POR_MINUTO = 12;
const HORA_MS = 3_600_000;
const MAX_POR_HORA = 80;
export const MAX_CARACTERES = 1500;

const porMinuto = new Map<string, number[]>();
const porHora = new Map<string, number[]>();

function podar(lista: number[], ahora: number, ventana: number): number[] {
  while (lista.length && ahora - lista[0] > ventana) lista.shift();
  return lista;
}

/** true si este contacto puede ser atendido ahora. */
export function permitirMensaje(clave: string, ahora = Date.now()): boolean {
  const m = podar(porMinuto.get(clave) ?? [], ahora, VENTANA_MS);
  const h = podar(porHora.get(clave) ?? [], ahora, HORA_MS);
  porMinuto.set(clave, m);
  porHora.set(clave, h);
  if (m.length >= MAX_POR_MINUTO || h.length >= MAX_POR_HORA) return false;
  m.push(ahora);
  h.push(ahora);
  return true;
}

export function recortar(texto: string): string {
  const t = (texto ?? '').trim();
  return t.length > MAX_CARACTERES ? t.slice(0, MAX_CARACTERES) : t;
}

function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** "quiero hablar con alguien", "me pasás con una persona", "hay alguien?" */
const PIDE_PERSONA = [
  /\b(hablar|charlar|comunicar\w*|contactar\w*)\b.*\b(con\s+)?(una\s+|un\s+|alguna\s+|algun\s+)?(persona|humano|humana|alguien|asesor\w*|operador\w*|chica|mery|el equipo|equipo)\b/,
  /\b(persona|humano|humana|alguien)\b.*\b(real|de verdad|del equipo|que me atienda|atienda)\b/,
  /\b(me\s+)?(pas[aá]s?|pasame|deriv[aá]\w*|comunic[aá]\w*)\b.*\b(persona|humano|alguien|asesor\w*|mery)\b/,
  /\b(hay|esta|estan)\s+(alguien|una persona)\b/,
  /\b(no\s+)?(quiero|necesito)\s+(un\s+|el\s+)?bot\b/,
  /\bsos\s+(un\s+)?(bot|robot)\b/,
  /\batenci[oó]n\s+humana\b/,
];

export function pidePersona(texto: string): boolean {
  const t = normalizar(texto);
  return PIDE_PERSONA.some((p) => p.test(t));
}

/** Patrones de alta precisión (raros en una consulta real de cejas). */
const ATAQUE = [
  /\bignor\w*\b.*\b(instruccion|regla|indicacion|anterior|previo|sistema)/,
  /\bolvid\w*\b.*\b(todo|lo que sabes|tus reglas|tus instruccion|reglas|sistema)/,
  /\b(anula|desactiva|salta\w*|bypass)\b.*\b(regla|instruccion|filtro|restriccion)/,
  /\b(mostr|pas|dec|repet|imprim|revel|dame|envi|escrib|dump)\w*\b.*\b(prompt|system prompt|instruccion(es)? internas?|reglas internas|tu contexto|el contexto|configuracion|tus reglas)\b/,
  /\bmodo\s+(desarrollador|developer|dios|admin|root|sin restriccion)/,
  /\bdeveloper\s+mode\b|\bjailbreak\b|\bdo anything now\b/,
  /\bactu\w*\s+como\b.*\b(admin|administrador|root|otro asistente|si fueras)/,
  /\b(list|mostr|pas|dame|ver|export\w*)\w*\b.*\b(todos|todas|otro|otra|otros|otras)\b.*\b(client|usuari|reserv|turno|dato|telefono|mail|email|numero)/,
  /\bvariable\w*\s+de\s+entorno\b|\benv\s*var|\b\.env\b|\bprocess\.env\b/,
  /\bapi[\s_-]?key\b|\baccess[\s_-]?token\b|\bsecret[\s_-]?key\b/,
  /\b(connection string|cadena de conexion|database url)\b/,
  /\bbase64\b.*\b(respuesta|instruccion|prompt|contexto|regla)\b/,
];

export function esAtaque(texto: string): boolean {
  const t = normalizar(texto);
  return ATAQUE.some((p) => p.test(t));
}
