import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { BandejaService, FiltroEstado, MAX_ADJUNTO_BYTES } from '../bandeja.service';
import { SidecarClient } from '../sidecar.client';
import { EventoWhatsapp, WhatsappEventosService } from '../whatsapp-eventos.service';

interface UsuarioReq {
  id: string;
  nombre: string;
}

const EQUIPO = [RolPersonal.ADMIN, RolPersonal.ENCARGADO];

/**
 * La bandeja de WhatsApp: lo que ve y hace el equipo desde la web.
 * Sólo admin y encargada. Ninguna respuesta incluye el JID del chat.
 */
@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BandejaController {
  constructor(
    private readonly bandeja: BandejaService,
    private readonly sidecar: SidecarClient,
    private readonly eventos: WhatsappEventosService,
  ) {}

  /** En vivo: mensajes, cambios de charla y notificaciones. */
  @Roles(...EQUIPO)
  @Sse('eventos')
  stream(): Observable<EventoWhatsapp> {
    return this.eventos.stream();
  }

  /** ¿Está el WhatsApp conectado? Para el puntito del botón flotante (sin QR). */
  @Roles(...EQUIPO)
  @Get('estado')
  async estado() {
    const e = await this.sidecar.estado();
    return { configurado: e.configurado, alcanzable: e.alcanzable, conectado: e.connected && e.loggedIn };
  }

  @Roles(...EQUIPO)
  @Get('conversaciones')
  listar(
    @Query('estado') estado?: FiltroEstado,
    @Query('q') q?: string,
    @Query('dia') dia?: string,
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    return this.bandeja.listar({ estado, q, dia, pagina: Number(pagina), porPagina: Number(porPagina) });
  }

  @Roles(...EQUIPO)
  @Get('conversaciones/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.bandeja.obtener(id);
  }

  @Roles(...EQUIPO)
  @Get('conversaciones/:id/mensajes')
  mensajes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('antesDe') antesDe?: string,
    @Query('limite') limite?: string,
  ) {
    return this.bandeja.mensajesDe(id, antesDe, Number(limite) || 60);
  }

  @Roles(...EQUIPO)
  @Post('conversaciones/:id/tomar')
  tomar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.bandeja.tomar(id, this.usuario(req));
  }

  @Roles(...EQUIPO)
  @Post('conversaciones/:id/devolver-bot')
  devolverBot(@Param('id', ParseUUIDPipe) id: string) {
    return this.bandeja.devolverAlBot(id);
  }

  @Roles(...EQUIPO)
  @Post('conversaciones/:id/mensajes')
  enviar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Body() dto: { texto: string }) {
    return this.bandeja.enviarTexto(id, this.usuario(req), dto?.texto ?? '');
  }

  /** multipart: `archivo` + `caption?` + `duracionSegundos?`. */
  @Roles(...EQUIPO)
  @Post('conversaciones/:id/adjuntos')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_ADJUNTO_BYTES, files: 1 } }))
  adjuntar(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() body: { caption?: string; duracionSegundos?: string },
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo.');
    const duracion = Number(body?.duracionSegundos);
    return this.bandeja.enviarAdjunto(
      id,
      this.usuario(req),
      archivo,
      body?.caption ?? null,
      Number.isFinite(duracion) && duracion > 0 ? Math.round(duracion) : null,
    );
  }

  @Roles(...EQUIPO)
  @Post('conversaciones/:id/cerrar')
  cerrar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Body() dto: { despedida?: boolean }) {
    return this.bandeja.cerrar(id, this.usuario(req), Boolean(dto?.despedida));
  }

  @Roles(...EQUIPO)
  @Put('conversaciones/:id/cliente')
  vincular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { clienteId: string | null }) {
    return this.bandeja.vincularCliente(id, dto?.clienteId ?? null);
  }

  /** Bytes de un adjunto. Respuesta cruda (no pasa por el sobre {status, data}). */
  @Roles(...EQUIPO)
  @Get('mensajes/:id/adjunto')
  async adjunto(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { datos, mimeType, nombre } = await this.bandeja.adjunto(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(datos.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.end(datos);
  }

  private usuario(req: Request): UsuarioReq {
    const u = req.user as { id: string; nombre: string };
    return { id: u.id, nombre: u.nombre };
  }
}
