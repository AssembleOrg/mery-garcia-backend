import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import stockConfig from '../config/stock.config';
import { OPCION_ANULAR, OPCION_CONFIRMAR } from './registro-productos';

/** Prefijo con el que el bot devuelve los votos de nuestras encuestas. */
export const REF_ENCUESTA = 'mery-stock:';

/**
 * Manda la encuesta "✅ Confirmar / ❌ Anular" al grupo de WhatsApp de
 * Pistech por el bot de Costear. Los votos vuelven a
 * POST /api/integraciones/whatsapp/votos. Si falta configuración o el bot
 * no responde, no pasa nada: el registro queda y se confirma solo.
 */
@Injectable()
export class AvisoWhatsappStockService {
  private readonly logger = new Logger(AvisoWhatsappStockService.name);

  constructor(
    @Inject(stockConfig.KEY)
    private readonly cfg: ConfigType<typeof stockConfig>,
  ) {}

  get configurado(): boolean {
    return Boolean(
      this.cfg.botUrl &&
        this.cfg.botSecret &&
        this.cfg.chat &&
        this.cfg.callbackSecret,
    );
  }

  /** Devuelve el id del mensaje, o null si no salió. Nunca tira. */
  async encuesta(solicitudId: string, titulo: string): Promise<string | null> {
    if (!this.configurado) {
      this.logger.warn(
        'Aviso por WhatsApp sin configurar (BOT_CONTROL_URL, BOT_PARTNER_SECRET, STOCK_WHATSAPP_CHAT, STOCK_POLL_CALLBACK_SECRET)',
      );
      return null;
    }
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 15_000);
    try {
      const res = await fetch(`${this.cfg.botUrl}/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Secret': this.cfg.botSecret,
        },
        body: JSON.stringify({
          chat: this.cfg.chat,
          name: titulo,
          options: [OPCION_CONFIRMAR, OPCION_ANULAR],
          multiple: false,
          ref: `${REF_ENCUESTA}${solicitudId}`,
          callbackUrl: `${this.cfg.publicUrl}/api/integraciones/whatsapp/votos`,
          callbackSecret: this.cfg.callbackSecret,
        }),
        signal: corte.signal,
      });
      const cuerpo = (await res.json().catch(() => ({}))) as {
        messageId?: string;
        error?: string;
      };
      if (!res.ok)
        throw new Error(
          `el bot respondió ${res.status}: ${cuerpo.error ?? ''}`,
        );
      return cuerpo.messageId ?? null;
    } catch (e) {
      this.logger.error(
        `No salió la encuesta del registro ${solicitudId}: ${(e as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(reloj);
    }
  }
}
