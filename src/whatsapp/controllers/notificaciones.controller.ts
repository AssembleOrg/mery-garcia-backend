import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { NotificacionesService } from '../notificaciones.service';

const EQUIPO = [RolPersonal.ADMIN, RolPersonal.ENCARGADO];

/** Avisos del sistema (por ahora, los del WhatsApp). Viven 72 h. */
@Controller('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Roles(...EQUIPO)
  @Get()
  listar(@Req() req: Request) {
    return this.notificaciones.listar(this.uid(req));
  }

  @Roles(...EQUIPO)
  @Post('leidas')
  async todasLeidas(@Req() req: Request) {
    await this.notificaciones.marcarTodasLeidas(this.uid(req));
    return { ok: true };
  }

  @Roles(...EQUIPO)
  @Post(':id/leida')
  async leida(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.notificaciones.marcarLeida(id, this.uid(req));
    return { ok: true };
  }

  private uid(req: Request): string {
    return (req.user as { id: string }).id;
  }
}
