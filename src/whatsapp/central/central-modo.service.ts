import { Injectable } from '@nestjs/common';

const ON_POR_DEFECTO = '/meryon';
const OFF_POR_DEFECTO = '/meryoff';

function normalizar(cmd: string | undefined, porDefecto: string): string {
  const c = (cmd ?? '').trim().toLowerCase() || porDefecto;
  return c.startsWith('/') ? c : `/${c}`;
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

  /** 'on' | 'off' si el texto es exactamente uno de los comandos. */
  comando(texto: string | null | undefined): 'on' | 'off' | null {
    const t = (texto ?? '').trim().toLowerCase();
    if (!t) return null;
    if (t === this.on) return 'on';
    if (t === this.off) return 'off';
    return null;
  }

  get comandoOn(): string {
    return this.on;
  }
}
