import { Body, Controller, Headers, HttpCode, Inject, Logger, Post } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import bookingConfig from '../config/booking.config';
import { ReservaPagadaDto, ReservasService } from './reservas.service';

/**
 * Entrada de reservas pagadas desde booking. Sin JWT: lo llama el servidor de
 * turnos, autenticado por el secret compartido en `X-Booking-Secret`
 * (comparado en tiempo constante).
 */
@ApiExcludeController()
@Controller('reservas')
export class ReservasController {
  private readonly logger = new Logger(ReservasController.name);

  constructor(
    @Inject(bookingConfig.KEY)
    private readonly cfg: ConfigType<typeof bookingConfig>,
    private readonly reservas: ReservasService,
  ) {}

  @Post('booking/pagada')
  @HttpCode(200)
  async reservaPagada(
    @Headers('x-booking-secret') secret: string | undefined,
    @Body() dto: ReservaPagadaDto,
  ) {
    if (!this.secretValido(secret)) {
      this.logger.warn('Reserva entrante con secret inválido, ignorada');
      return { ok: false, error: 'no autorizado' };
    }
    return this.reservas.ingerirReservaPagada(dto);
  }

  private secretValido(dado: string | undefined): boolean {
    const esperado = this.cfg.syncSecret;
    if (!esperado || !dado) return false;
    const a = Buffer.from(dado);
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
