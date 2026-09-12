import { Body, Controller, Headers, HttpCode, Inject, Logger, Post } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import whatsappConfig from '../../config/whatsapp.config';
import { BotService, EntranteSidecar } from '../bot.service';

/**
 * Entrada de mensajes desde el sidecar. Sin JWT: lo autentica el secret
 * compartido en `X-Sidecar-Secret`, comparado en tiempo constante.
 *
 * Responde 200 enseguida y procesa aparte: responder al bot lleva segundos
 * (espera de ráfaga, clasificador, tipeo humanizado) y el sidecar no tiene
 * por qué quedarse colgado esperando. Si algo falla queda en el log; el
 * sidecar no reintenta.
 */
@ApiExcludeController()
@Controller('whatsapp/sidecar')
export class SidecarController {
  private readonly logger = new Logger(SidecarController.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly cfg: ConfigType<typeof whatsappConfig>,
    private readonly bot: BotService,
  ) {}

  @Post('entrante')
  @HttpCode(200)
  async entrante(
    @Headers('x-sidecar-secret') secret: string | undefined,
    @Body() body: EntranteSidecar,
  ): Promise<{ ok: true }> {
    if (!this.secretValido(secret)) {
      this.logger.warn('Entrante con secret inválido, ignorado');
      return { ok: true };
    }
    if (body?.kind === 'escribiendo') {
      void this.bot.clientaEscribiendo(body.chatJid).catch(() => undefined);
      return { ok: true };
    }
    void this.bot.procesarEntrante(body).catch((error: Error) => {
      this.logger.error(`Error procesando entrante: ${error.message}`, error.stack);
    });
    return { ok: true };
  }

  private secretValido(dado: string | undefined): boolean {
    const esperado = this.cfg.sidecarSecret;
    if (!esperado || !dado) return false;
    const a = Buffer.from(dado);
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
