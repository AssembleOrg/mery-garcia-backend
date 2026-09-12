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
 * Siempre responde 200: si acá algo falla, que el sidecar no reintente en
 * loop; el error queda en el log.
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
    try {
      await this.bot.procesarEntrante(body);
    } catch (error) {
      this.logger.error(`Error procesando entrante: ${(error as Error).message}`, (error as Error).stack);
    }
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
