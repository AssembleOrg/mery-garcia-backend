import { Injectable } from '@nestjs/common';

const ON_POR_DEFECTO = '/meryon';
const OFF_POR_DEFECTO = '/meryoff';

function normalizar(cmd: string | undefined, porDefecto: string): string {
  const c = (cmd ?? '').trim().toLowerCase() || porDefecto;
  return c.startsWith('/') ? c : `/${c}`;
}

/** "/Mery On!" → "meryon": sin barra, espacios, signos ni tildes. */
function compacto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Lo que la central decide sobre el "modo prueba" del bot (panel de la
 * central → Comportamiento). Vive aparte del espejo para que el bot lo pueda
 * consultar sin depender de toda la integración.
 *
 * Sin central conectada queda en sus valores por defecto: modo prueba
 * apagado y los comandos /meryon y /meryoff.
 */
@Injectable()
export class CentralModoService {
  private prueba = false;
  private on = ON_POR_DEFECTO;
  private off = OFF_POR_DEFECTO;

  aplicar(testMode: { enabled?: boolean; on_cmd?: string; off_cmd?: string } | null | undefined): void {
    this.prueba = !!testMode?.enabled;
    this.on = normalizar(testMode?.on_cmd, ON_POR_DEFECTO);
    this.off = normalizar(testMode?.off_cmd, OFF_POR_DEFECTO);
  }

  /**
   * Modo prueba prendido desde la central: el bot sólo contesta en los chats
   * donde alguien lo prendió con el comando.
   */
  get pruebaActiva(): boolean {
    return this.prueba;
  }

  /**
   * 'on' | 'off' si el texto es uno de los comandos, escrito como sea: "Mery on",
   * "mery on", "/meryon", "Mary off"… (sin barra, mayúsculas, espacios o tildes).
   */
  comando(texto: string | null | undefined): 'on' | 'off' | null {
    const t = compacto(texto);
    if (!t) return null;
    const on = compacto(this.on);
    const off = compacto(this.off);
    // "mary" es cómo lo escribe mucha gente; vale igual que "mery".
    const variantes = (c: string) => [c, c.replace(/^mery/, 'mary')];
    if (variantes(on).includes(t)) return 'on';
    if (variantes(off).includes(t)) return 'off';
    return null;
  }

  get comandoOn(): string {
    return this.on;
  }
}
