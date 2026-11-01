import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import ritmoConfig from '../config/ritmo.config';
import { secretoIgual } from '../common/utils/secreto-igual';
import { hoyEnEmpresa } from '../ritmo/turnos/fechas';
import { validarPedidoRitmo } from './registro-productos';
import { RegistroRitmoService } from './registro-ritmo.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registro de productos que Ritmo le pide a este sistema (su "URL de
 * registro de productos"). Mismo secreto que el resumen de jornada
 * (`X-Ritmo-Secret`), sin JWT.
 */
@ApiExcludeController()
@Controller('integraciones/ritmo')
export class RegistroRitmoController {
  constructor(
    @Inject(ritmoConfig.KEY)
    private readonly cfg: ConfigType<typeof ritmoConfig>,
    private readonly registro: RegistroRitmoService,
  ) {}

  /** GET /api/integraciones/ritmo/productos?userId&day&q */
  @Get('productos')
  async leer(
    @Headers('x-ritmo-secret') secret: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('day') day: string | undefined,
    @Query('q') q: string | undefined,
  ) {
    if (!secretoIgual(this.cfg.resumenSecret, secret))
      throw new UnauthorizedException();
    if (!userId || !UUID.test(userId))
      throw new BadRequestException('Falta userId.');
    try {
      return await this.registro.leer(
        userId,
        day || hoyEnEmpresa(),
        (q ?? '').slice(0, 100),
      );
    } catch (e) {
      if (e instanceof Error && !('status' in e))
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** POST /api/integraciones/ritmo/productos { userId, action: create|cancel, ... } */
  @Post('productos')
  @HttpCode(200)
  async ejecutar(
    @Headers('x-ritmo-secret') secret: string | undefined,
    @Body() body: unknown,
  ) {
    if (!secretoIgual(this.cfg.resumenSecret, secret))
      throw new UnauthorizedException();
    let pedido: ReturnType<typeof validarPedidoRitmo>;
    try {
      pedido = validarPedidoRitmo(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    return this.registro.ejecutar(pedido);
  }
}
