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
import { ConfigType } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import ritmoConfig from '../../config/ritmo.config';
import { secretoIgual } from '../../common/utils/secreto-igual';
import { ServiciosDiaService } from './servicios-dia.service';
import { validarDia } from './resumen';
import { ConfirmarResumenDto } from './dto/servicios.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo que Ritmo le pregunta a este sistema: qué servicios hizo una persona en
 * un día, y la confirmación que esa persona dio desde la app. Sin JWT: Ritmo
 * se identifica con el secreto compartido en `X-Ritmo-Secret` (comparado en
 * tiempo constante). Es la "fuente de resumen de jornada" de Ritmo.
 */
@ApiExcludeController()
@Controller('integraciones/ritmo')
export class ResumenRitmoController {
  constructor(
    @Inject(ritmoConfig.KEY)
    private readonly cfg: ConfigType<typeof ritmoConfig>,
    private readonly servicios: ServiciosDiaService,
  ) {}

  /** GET /api/integraciones/ritmo/resumen?userId=<uuid de Ritmo>&day=AAAA-MM-DD */
  @Get('resumen')
  async resumen(
    @Headers('x-ritmo-secret') secret: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('day') day: string | undefined,
  ) {
    if (!this.secretValido(secret)) throw new UnauthorizedException();
    if (!userId || !UUID.test(userId))
      throw new BadRequestException('Falta userId.');
    if (!day) throw new BadRequestException('Falta day.');
    try {
      // Antes del arranque no hay nada que mostrar ni que confirmar.
      if (validarDia(day) < this.cfg.resumenDesde)
        return { available: false, day };
      return await this.servicios.resumenParaRitmo(userId, day);
    } catch (e) {
      if (e instanceof Error && !('status' in e))
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** POST /api/integraciones/ritmo/resumen { userId, day, agreed, note, punchId } */
  @Post('resumen')
  @HttpCode(200)
  async confirmar(
    @Headers('x-ritmo-secret') secret: string | undefined,
    @Body() dto: ConfirmarResumenDto,
  ) {
    if (!this.secretValido(secret)) throw new UnauthorizedException();
    try {
      if (validarDia(dto.day) < this.cfg.resumenDesde) {
        throw new BadRequestException(
          `El resumen de servicios arranca el ${this.cfg.resumenDesde.split('-').reverse().join('/')}: ese día no se confirma.`,
        );
      }
      return await this.servicios.confirmarDesdeRitmo(dto);
    } catch (e) {
      if (e instanceof Error && !('status' in e))
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  private secretValido(dado: string | undefined): boolean {
    return secretoIgual(this.cfg.resumenSecret, dado);
  }
}
