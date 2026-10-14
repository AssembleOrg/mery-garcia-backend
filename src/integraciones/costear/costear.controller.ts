import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import costearConfig from '../../config/costear.config';
import { CajaTotalesService } from './caja-totales.service';

/**
 * Lectura para Costear. Sin JWT: la llama el backend de Costear, autenticado
 * por el secret compartido en `X-Costear-Secret` (comparado en tiempo constante).
 */
@ApiExcludeController()
@Controller('integraciones/costear')
export class CostearController {
  constructor(
    @Inject(costearConfig.KEY)
    private readonly cfg: ConfigType<typeof costearConfig>,
    private readonly caja: CajaTotalesService,
  ) {}

  /** GET /api/integraciones/costear/caja?desde=AAAA-MM-DD&hasta=AAAA-MM-DD */
  @Get('caja')
  async totalesDeCaja(
    @Headers('x-costear-secret') secret: string | undefined,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    if (!this.secretValido(secret)) throw new UnauthorizedException();
    try {
      return await this.caja.totales(desde ?? '', hasta ?? desde ?? '');
    } catch (e) {
      if (e instanceof Error && !('code' in e))
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  private secretValido(dado: string | undefined): boolean {
    const esperado = this.cfg.syncSecret;
    if (!esperado || !dado) return false;
    const a = Buffer.from(dado);
    const b = Buffer.from(esperado);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
