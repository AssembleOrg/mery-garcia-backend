import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrearTurnoDto, EditarTurnoDto, HorariosService } from './horarios.service';
import { PatronService, TramoDto } from './patron.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';

/**
 * Horarios del equipo, en dos capas:
 *
 * - `patron`: el horario que se repite todas las semanas. Editarlo cambia de
 *   acá en adelante, porque el cron del domingo genera desde él.
 * - `semana` / `turno`: los turnos ya generados de una semana concreta.
 *   Tocar un turno cambia ese día y nada más.
 */
@Controller('ritmo/horarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HorariosController {
  constructor(
    private readonly horarios: HorariosService,
    private readonly patron: PatronService,
  ) {}

  // ------------------------------------------------------- semana y turnos

  /** Grilla de la semana. `desde` tiene que ser lunes (YYYY-MM-DD). */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get('semana')
  semana(@Query('desde') desde: string) {
    return this.horarios.semana(desde);
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('turno')
  crearTurno(@Body() dto: CrearTurnoDto) {
    return this.horarios.crearTurno(dto);
  }

  /**
   * Cambia un turno: de día, de persona o de horario. Si cambia el horario, el
   * turno se rehace (Ritmo no deja editarle la hora) y queda con otro id.
   */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Patch('turno/:shiftId')
  editarTurno(@Param('shiftId') shiftId: string, @Body() cambios: EditarTurnoDto) {
    return this.horarios.editarTurno(shiftId, cambios);
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Delete('turno/:shiftId')
  borrarTurno(@Param('shiftId') shiftId: string) {
    return this.horarios.borrarTurno(shiftId);
  }

  /** Publicar: recién ahí el equipo ve la semana en su teléfono. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('publicar')
  publicar(@Body() body: { weekStart: string }) {
    return this.horarios.publicar(body.weekStart);
  }

  /** Rearma la semana desde el patrón sin pisar lo que ya está cargado. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('generar')
  generar(@Body() body: { weekStart: string }) {
    return this.horarios.generarDesdePatron(body.weekStart);
  }

  // ---------------------------------------------------------------- patrón

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get('patron')
  verPatron() {
    return this.patron.porPersona();
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('patron')
  crearTramo(@Body() dto: TramoDto) {
    return this.patron.crearTramo(dto);
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Patch('patron/:id')
  editarTramo(@Param('id') id: string, @Body() cambios: Partial<TramoDto>) {
    return this.patron.actualizarTramo(id, cambios);
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Delete('patron/:id')
  borrarTramo(@Param('id') id: string) {
    return this.patron.borrarTramo(id);
  }

  /** Carga el horario inicial. No hace nada si el patrón ya tiene algo. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Post('patron/sembrar')
  sembrar() {
    return this.patron.sembrarSiEstaVacio();
  }
}
