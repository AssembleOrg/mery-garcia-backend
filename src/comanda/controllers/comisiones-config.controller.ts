import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { ComisionesConfigService } from '../services/comisiones-config.service';
import { ActualizarEsquemaComisionDto, ConfirmarPorcentajeMesDto } from '../dto/comisiones-config.dto';

@ApiTags('Comisiones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('comisiones-config')
export class ComisionesConfigController {
  constructor(private readonly service: ComisionesConfigService) {}

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Esquema de comisión de cada trabajadora: rango, bases por categoría y meses confirmados' })
  obtener() {
    return this.service.obtener();
  }

  @Put('trabajadores/:id')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Editar rango, % de productos, fecha de inicio y bases (las bases enviadas reemplazan a las anteriores)' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEsquemaComisionDto) {
    return this.service.actualizarEsquema(id, dto);
  }

  @Put('trabajadores/:id/meses/:mes')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Confirmar el porcentaje de un mes (YYYY-MM) al cierre' })
  confirmarMes(@Param('id', ParseUUIDPipe) id: string, @Param('mes') mes: string, @Body() dto: ConfirmarPorcentajeMesDto) {
    return this.service.confirmarMes(id, mes, dto);
  }

  @Delete('trabajadores/:id/meses/:mes')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Quitar el porcentaje confirmado de un mes (vuelve al mínimo del rango)' })
  quitarMes(@Param('id', ParseUUIDPipe) id: string, @Param('mes') mes: string) {
    return this.service.quitarMes(id, mes);
  }
}
