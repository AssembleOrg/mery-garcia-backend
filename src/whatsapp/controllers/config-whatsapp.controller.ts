import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { ConfigInput, ConfigWhatsappService, RespuestaInput } from '../config-whatsapp.service';
import { SidecarClient } from '../sidecar.client';
import { ClasificadorService } from '../clasificador.service';

/** Configuración del bot: respuestas, textos, horario y la sesión de WhatsApp. Sólo admin. */
@Controller('whatsapp/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigWhatsappController {
  constructor(
    private readonly config: ConfigWhatsappService,
    private readonly sidecar: SidecarClient,
    private readonly clasificador: ClasificadorService,
  ) {}

  @Roles(RolPersonal.ADMIN)
  @Get()
  async obtener() {
    const cfg = await this.config.obtener();
    return { ...cfg, clasificadorConfigurado: this.clasificador.configurado };
  }

  @Roles(RolPersonal.ADMIN)
  @Put()
  actualizar(@Body() dto: ConfigInput) {
    return this.config.actualizar(dto ?? {});
  }

  @Roles(RolPersonal.ADMIN)
  @Get('respuestas')
  respuestas() {
    return this.config.listarRespuestas();
  }

  @Roles(RolPersonal.ADMIN)
  @Post('respuestas')
  crearRespuesta(@Body() dto: RespuestaInput) {
    return this.config.crearRespuesta(dto);
  }

  @Roles(RolPersonal.ADMIN)
  @Put('respuestas/:id')
  editarRespuesta(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<RespuestaInput>) {
    return this.config.editarRespuesta(id, dto ?? {});
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('respuestas/:id')
  async borrarRespuesta(@Param('id', ParseUUIDPipe) id: string) {
    await this.config.borrarRespuesta(id);
    return { ok: true };
  }

  /** Estado del sidecar con el QR (PNG base64) cuando hay que vincular. */
  @Roles(RolPersonal.ADMIN)
  @Get('sesion')
  sesion() {
    return this.sidecar.estado();
  }

  @Roles(RolPersonal.ADMIN)
  @Post('sesion/refrescar')
  async refrescar() {
    await this.sidecar.refrescarSesion();
    return { ok: true };
  }

  @Roles(RolPersonal.ADMIN)
  @Post('sesion/reiniciar')
  async reiniciar() {
    await this.sidecar.reiniciar();
    return { ok: true };
  }

  @Roles(RolPersonal.ADMIN)
  @Post('sesion/cerrar')
  async cerrarSesion() {
    await this.sidecar.cerrarSesion();
    return { ok: true };
  }
}
