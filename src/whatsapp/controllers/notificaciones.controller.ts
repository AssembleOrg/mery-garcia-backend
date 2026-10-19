import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import {
  EventoPersonal,
  NotificacionesService,
} from '../notificaciones.service';

const EQUIPO = [RolPersonal.ADMIN, RolPersonal.ENCARGADO];
/** Cualquier sesión puede leer los avisos dirigidos a ella. */
const TODOS = Object.values(RolPersonal);

/**
 * Avisos del sistema. Viven 72 h. Los del equipo (WhatsApp, solicitudes de
 * stock) los ve admin y encargada; "mias" son los dirigidos a una persona
 * (p. ej. al empleado cuando le resuelven una solicitud).
 */
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

  @Roles(...TODOS)
  @Get('mias')
  listarMias(@Req() req: Request) {
    return this.notificaciones.listarMias(this.uid(req));
  }

  @Roles(...TODOS)
  @Sse('mias/eventos')
  streamMias(@Req() req: Request): Observable<EventoPersonal> {
    return this.notificaciones.streamMias(this.uid(req));
  }

  @Roles(...TODOS)
  @Post('mias/leidas')
  async todasMiasLeidas(@Req() req: Request) {
    await this.notificaciones.marcarTodasLeidas(this.uid(req), true);
    return { ok: true };
  }

  @Roles(...TODOS)
  @Post(':id/leida')
  async leida(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.notificaciones.marcarLeida(id, this.uid(req));
    return { ok: true };
  }

  private uid(req: Request): string {
    return (req.user as { id: string }).id;
  }
}
