import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { EntregaRitmo, RitmoWebhooksService } from './webhooks.service';

/**
 * Recibe los avisos de Ritmo (entre ellos `fichaje.registrado`: llega apenas
 * alguien ficha).
 *
 * Tres reglas que impone Ritmo y que se respetan acá:
 * 1. La firma se valida sobre el cuerpo CRUDO, nunca sobre el JSON reparseado.
 * 2. Hay que contestar 2xx en menos de 10 s: se guarda y se contesta; la
 *    reacción corre después, fuera del request.
 * 3. Un reintento repite el mismo `id`, así que se descarta por idempotencia.
 */
@Controller('ritmo/webhook')
export class RitmoWebhooksController {
  constructor(private readonly webhooks: RitmoWebhooksService) {}

  @Post()
  @HttpCode(200)
  async recibir(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-ritmo-signature') firma?: string,
  ): Promise<{ recibido: true }> {
    const crudo = req.rawBody?.toString('utf8');
    if (!crudo) {
      throw new UnauthorizedException('Cuerpo vacío o sin cuerpo crudo.');
    }
    if (!this.webhooks.verificar(firma, crudo)) {
      throw new UnauthorizedException('Firma inválida.');
    }

    const entrega = JSON.parse(crudo) as EntregaRitmo;

    // Nuevo: se procesa. Repetido: ya se procesó, se contesta 200 igual para
    // que Ritmo deje de reintentar.
    if (await this.webhooks.registrar(entrega)) {
      void this.webhooks.procesar(entrega);
    }

    return { recibido: true };
  }
}
