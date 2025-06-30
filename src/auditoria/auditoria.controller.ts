import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { AuditoriaService } from './auditoria.service';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles(RolPersonal.ADMIN)
  async obtenerAuditoria(
    @Query('modulo') modulo?: ModuloSistema,
    @Query('tipoAccion') tipoAccion?: TipoAccion,
    @Query('usuarioId') usuarioId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : undefined;
    const fechaFinDate = fechaFin ? new Date(fechaFin) : undefined;

    return await this.auditoriaService.obtenerAuditoria(
      modulo,
      tipoAccion,
      usuarioId,
      fechaInicioDate,
      fechaFinDate,
      limit,
      offset,
    );
  }

  @Get('usuario/:usuarioId')
  @Roles(RolPersonal.ADMIN)
  async obtenerAuditoriaPorUsuario(
    @Query('usuarioId') usuarioId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return await this.auditoriaService.obtenerAuditoriaPorUsuario(usuarioId, limit);
  }

  @Get('modulo/:modulo')
  @Roles(RolPersonal.ADMIN)
  async obtenerAuditoriaPorModulo(
    @Query('modulo') modulo: ModuloSistema,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return await this.auditoriaService.obtenerAuditoriaPorModulo(modulo, limit);
  }
} 