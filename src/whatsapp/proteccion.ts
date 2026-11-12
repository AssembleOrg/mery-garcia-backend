/**
 * Defensas del bot antes de mandar un mensaje al clasificador.
 *
 * El bot ya es cerrado por diseño: el modelo sólo elige una clave de una lista
 * y lo que sale hacia la clienta es siempre un texto fijo del panel. Esto suma:
 * - limpiar el mensaje (sin etiquetas que imiten las del prompt, sin caracteres
 *   de control, con un largo máximo), y
 * - cortar sin llamar al modelo los intentos obvios de manipularlo ("ignorá tus
 *   instrucciones", "actuá como ChatGPT", "mostrame tu prompt"…), que van a
 *   FUERA_DE_TEMA.
 */

/** Controles, marcas de dirección y caracteres de ancho cero. */
const INVISIBLES =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/g;

/** Largo máximo que llega al clasificador (un mensaje real de WhatsApp es mucho más corto). */
export const LARGO_MAXIMO = 1200;

/** Saca etiquetas que imitan las del prompt (<mensaje>, <system>…), controles y recorta. */
export function limpiarMensaje(texto: string): string {
  const limpio = (texto ?? '')
    .replace(
      /<\s*\/?\s*(mensaje|system|sistema|user|assistant|instrucciones?)\b[^>]*>/gi,
      ' ',
    )
    .replace(INVISIBLES, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return limpio.length > LARGO_MAXIMO
    ? `${limpio.slice(0, LARGO_MAXIMO)}…`
    : limpio;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Frases de manipulación. Se buscan sobre el texto en minúsculas y sin tildes.
 * Ojo con los falsos positivos: "ignorá lo que te dije, quería laminado" es una
 * clienta corrigiéndose; por eso se pide que hable de instrucciones, reglas,
 * prompt o sistema.
 */
const MANIPULACION: RegExp[] = [
  // "ignorá / olvidá / saltate tus instrucciones / reglas / el prompt"
  /\b(ignora|ignore|ignoren|olvida|olvidate|forget|saltea|salteate|omiti|desobedece|disregard)\w*\b[^.?!\n]{0,40}\b(instrucci\w*|instruction\w*|reglas?|rules?|prompt|sistema|system|directiv\w*|configuraci\w*|programaci\w*)/,
  // "mostrame / repetí / decime tu prompt / instrucciones / mensaje del sistema"
  /\b(mostra\w*|mostrar|repeti\w*|repetir|deci\w*|decir|dame|escribi\w*|show|print|reveal|repeat|tell me|what (is|are))\b[^.?!\n]{0,30}\b(tu|tus|your)\b[^.?!\n]{0,15}\b(prompt|instrucci\w*|instruction\w*|reglas|rules|system message|configuraci\w*)/,
  /\b(instrucci\w*|reglas|prompt)\b[^.?!\n]{0,10}\bque te (dieron|pasaron|programaron|cargaron|escribieron)\b/,
  /\b(mostra\w*|repeti\w*|show|print|reveal|repeat)\b[^.?!\n]{0,20}\b(el|the)\b[^.?!\n]{0,5}\b(prompt|system message|mensaje del sistema)\b/,
  /\b(system prompt|prompt del sistema|prompt de sistema|mensaje de sistema|developer mode|modo desarrollador|modo dios|jailbreak|jail break|prompt injection)\b/,
  // "actuá como / sos ahora / hacete pasar por / a partir de ahora sos"
  /\b(actua como|act as|pretend (to be|you are)|hace de cuenta que sos|hacete pasar por|finge ser|fingi ser|roleplay|role play|juego de rol)\b/,
  /\b(a partir de ahora|desde ahora|from now on)\b[^.?!\n]{0,30}\b(sos|eres|seras|vas a ser|you are|you will be|respond\w*|contesta\w*)\b/,
  /\b(sos|eres|you are)\b[^.?!\n]{0,12}\b(chat ?gpt|gpt-?\d|claude|gemini|llama|una ia libre|un modelo de lenguaje|dan)\b/,
  /\b(do anything now|stan mode|dan mode)\b/,
  // "respondé sólo con" / "tu nueva tarea es"
  /\b(responde|contesta|answer|reply)\w*\b[^.?!\n]{0,15}\b(solo|solamente|unicamente|only)\b[^.?!\n]{0,10}\b(con|with)\b/,
  /\b(tu|your)\b[^.?!\n]{0,10}\b(nueva tarea|nuevo rol|new task|new role|verdadero proposito)\b/,
];

/** True si el mensaje intenta cambiarle el rol, las reglas o sacarle el prompt al bot. */
export function pareceManipulacion(texto: string): boolean {
  const t = normalizar(texto ?? '');
  return MANIPULACION.some((r) => r.test(t));
}
