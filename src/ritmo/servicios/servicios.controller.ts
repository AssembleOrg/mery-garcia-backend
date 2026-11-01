import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServiciosDiaService } from './servicios-dia.service';
import { VincularRitmoDto } from './dto/servicios.dto';
import { hoyEnEmpresa } from '../turnos/fechas';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';

/**
 * Servicios por trabajadora y día, y lo que cada una confirmó desde Ritmo.
 * Presentismo lo mira junto con las horas; el vínculo trabajadora ↔ persona
 * de Ritmo lo carga administración.
 */
@Controller('ritmo/servicios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiciosController {
  constructor(private readonly servicios: ServiciosDiaService) {}

  /** Un renglón por trabajadora y día (por defecto, hoy). */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get()
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const d = desde || hoyEnEmpresa();
    return this.servicios.listar(d, hasta || d);
  }

  /** Quién es quién: cada trabajadora con su persona en Ritmo (o la sugerida). */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get('vinculos')
  vinculos() {
    return this.servicios.vinculos();
  }

  /** Vincular (ritmoUserId) y decir si debe confirmar al cerrar el turno. */
  @Roles(RolPersonal.ADMIN)
  @Patch('vinculos/:trabajadorId')
  vincular(
    @Param('trabajadorId', ParseUUIDPipe) trabajadorId: string,
    @Body() dto: VincularRitmoDto,
  ) {
    return this.servicios.vincular(trabajadorId, dto);
  }
}
