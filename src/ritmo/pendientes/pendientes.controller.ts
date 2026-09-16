import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RitmoService } from '../ritmo.service';
import { IncidenciaDecision } from '../ritmo.types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';

/**
 * Lo que está esperando una decisión: licencias y vacaciones pedidas, fichajes
 * que quedaron a revisar, llegadas tarde y horas extra.
 *
 * Van juntos a propósito, como en Ritmo: para quien administra son la misma
 * tarea —mirar y decidir—, y separarlos obligaría a acordarse de entrar a
 * varias pantallas distintas.
 */
@Controller('ritmo/pendientes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PendientesController {
  constructor(private readonly ritmo: RitmoService) {}

  /** La bandeja, con el conteo por tipo. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get()
  bandeja() {
    return this.ritmo.listarIncidencias();
  }

  /**
   * Aprueba o rechaza. Acepta varios ids de una: aprobar diez fichajes
   * dudosos de la misma tarde es un solo gesto, no diez.
   */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('resolver')
  resolver(@Body() dto: { ids: string[]; decision: IncidenciaDecision }) {
    return this.ritmo.resolverIncidencias(dto);
  }
}
