import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FicharKioscoDto, KioscoService } from './kiosco.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';

/**
 * Pantalla de kiosco del salón. Es presentismo, así que vive en la app; el
 * resto de Ritmo sigue fuera.
 */
@Controller('ritmo/kiosco')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KioscoController {
  constructor(private readonly kiosco: KioscoService) {}

  /** Equipo con su estado de ahora: a quién le toca ENTRADA y a quién SALIDA. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Get()
  estado() {
    return this.kiosco.estado();
  }

  /**
   * Ficha por una persona. La pantalla manda la ubicación que mide el aparato;
   * si no la tiene, va null y Ritmo decide según la regla de la empresa.
   */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Post('fichar')
  fichar(@Body() dto: FicharKioscoDto) {
    return this.kiosco.fichar(dto);
  }
}
