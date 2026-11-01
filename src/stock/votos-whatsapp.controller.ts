import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import stockConfig from '../config/stock.config';
import { secretoIgual } from '../common/utils/secreto-igual';
import { REF_ENCUESTA } from './aviso-whatsapp-stock.service';
import { EstadoSolicitudStock } from './entities/SolicitudStock.entity';
import { decisionDelVoto, votanteAutorizado } from './registro-productos';
import { SolicitudesStockService } from './solicitudes-stock.service';

interface VotoDelBot {
  ref?: unknown;
  voter?: { phone?: unknown; name?: unknown };
  selected?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El bot de WhatsApp avisa cada voto de la encuesta de un registro de
 * productos. Sólo cuentan los teléfonos de STOCK_VOTANTES; lo que responde
 * `reply` el bot lo publica en el grupo.
 */
@ApiExcludeController()
@Controller('integraciones/whatsapp')
export class VotosWhatsappController {
  private readonly logger = new Logger(VotosWhatsappController.name);

  constructor(
    @Inject(stockConfig.KEY)
    private readonly cfg: ConfigType<typeof stockConfig>,
    private readonly solicitudes: SolicitudesStockService,
  ) {}

  /** POST /api/integraciones/whatsapp/votos */
  @Post('votos')
  @HttpCode(200)
  async voto(
    @Headers('x-bot-secret') secret: string | undefined,
    @Body() body: VotoDelBot,
  ): Promise<{ reply: string | null }> {
    if (!secretoIgual(this.cfg.callbackSecret, secret))
      throw new UnauthorizedException();

    const ref = typeof body?.ref === 'string' ? body.ref : '';
    const id = ref.startsWith(REF_ENCUESTA)
      ? ref.slice(REF_ENCUESTA.length)
      : '';
    if (!UUID.test(id)) return { reply: null };

    const comoTexto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const telefono = comoTexto(body.voter?.phone);
    const nombre = comoTexto(body.voter?.name) || telefono || 'alguien';
    const elegidas = Array.isArray(body.selected)
      ? body.selected.filter((x): x is string => typeof x === 'string')
      : [];

    if (!votanteAutorizado(telefono, this.cfg.votantes)) {
      this.logger.warn(
        `Voto ignorado de ${nombre} (${telefono || 'sin teléfono'}) en ${id}: no está en STOCK_VOTANTES`,
      );
      return { reply: null };
    }
    const decision = decisionDelVoto(elegidas);
    if (!decision) return { reply: null };

    try {
      const s = await this.solicitudes.resolverPorVoto(id, decision, nombre);
      this.logger.log(
        `${nombre} ${decision === EstadoSolicitudStock.APROBADA ? 'confirmó' : 'anuló'} el registro ${id}`,
      );
      const quien = s.trabajador?.nombre ?? '';
      return {
        reply:
          decision === EstadoSolicitudStock.APROBADA
            ? `✔️ Confirmado por ${nombre}${quien ? ` (${quien})` : ''}`
            : `🚫 Anulado por ${nombre}${quien ? ` (${quien})` : ''}`,
      };
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 409)
        return { reply: `ℹ️ ${e.message}: no cambia nada.` };
      if (e instanceof HttpException && e.getStatus() === 404)
        return { reply: null };
      throw e;
    }
  }
}
