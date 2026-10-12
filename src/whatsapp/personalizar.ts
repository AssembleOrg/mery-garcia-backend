/**
 * Personalización de los textos del bot: con quién habla la clienta y cómo se
 * llama ella. Funciones puras (sin base de datos) para poder probarlas solas.
 */

/** Primer nombre presentable: el de la ficha de clienta gana al de WhatsApp. */
export function primerNombre(
  cliente?: string | null,
  whatsapp?: string | null,
): string | null {
  for (const fuente of [cliente, whatsapp]) {
    const palabra =
      (fuente ?? '').normalize('NFC').trim().split(/\s+/)[0] ?? '';
    // Sólo letras (con tildes, apóstrofe o guión): descarta emojis, números y apodos raros.
    if (/^\p{L}[\p{L}'-]{1,19}$/u.test(palabra)) {
      return (
        palabra.charAt(0).toLocaleUpperCase('es') +
        palabra.slice(1).toLocaleLowerCase('es')
      );
    }
  }
  return null;
}

/**
 * Reemplaza {nombre} por el nombre de la clienta. Sin nombre, se va también el
 * espacio de adelante: "¡Hola {nombre}!" → "¡Hola Ana!" o "¡Hola!".
 */
export function completar(texto: string, nombre: string | null): string {
  return texto.replace(/\s*\{nombre\}/g, nombre ? ` ${nombre}` : '');
}

/**
 * "Hola", con o sin "¿cómo estás?", signos y emojis, al principio del texto.
 * Así arrancan casi todas las respuestas de la tabla.
 */
const SALUDO_INICIAL =
  /^\s*¡?\s*hola+(?![\p{L}\p{N}])[\s!¡.,]*(?:¿?\s*c[oó]mo\s+(?:est[aá]s|and[aá]s)\s*\?*)?[\s!?.,]*(?:(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D)\s*)*/iu;

/**
 * Saca el saludo del principio de una respuesta. Se usa cuando la charla ya
 * está empezada (o cuando la presentación ya saludó): repetir "Hola, ¿cómo
 * estás?" en cada respuesta suena a contestador automático.
 *
 * Si el texto era sólo el saludo, se deja como está.
 */
export function sinSaludo(texto: string): string {
  const resto = texto.replace(SALUDO_INICIAL, '').trimStart();
  if (!resto) return texto;
  return resto.charAt(0).toLocaleUpperCase('es') + resto.slice(1);
}
