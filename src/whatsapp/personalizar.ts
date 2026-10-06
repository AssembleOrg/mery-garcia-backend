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
