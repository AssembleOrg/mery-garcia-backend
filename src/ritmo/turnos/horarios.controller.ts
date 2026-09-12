import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CrearTurnoDto, EditarTurnoDto, HorariosService } from './horarios.service';
import { PatronService, TramoDto } from './patron.service';

/**
 * Horarios del equipo, en dos capas:
 *
 * - `patron`: el horario que se repite todas las semanas. Editarlo cambia de
 *   acá en adelante, porque el cron del domingo genera desde él.
 * - `semana` / `turno`: los turnos ya generados de una semana concreta.
 *   Tocar un turno cambia ese día y nada más.
 */
@Controller('ritmo/horarios')
export class HorariosController {
  constructor(
    private readonly horarios: HorariosService,
    private readonly patron: PatronService,
  ) {}

  // ------------------------------------------------------- semana y turnos

  /** Grilla de la semana. `desde` tiene que ser lunes (YYYY-MM-DD). */
  @Get('semana')
  semana(@Query('desde') desde: string) {
    return this.horarios.semana(desde);
  }

  @Post('turno')
  crearTurno(@Body() dto: CrearTurnoDto) {
    return this.horarios.crearTurno(dto);
  }

  /**
   * Cambia un turno: de día, de persona o de horario. Si cambia el horario, el
   * turno se rehace (Ritmo no deja editarle la hora) y queda con otro id.
   */
  @Patch('turno/:shiftId')
  editarTurno(@Param('shiftId') shiftId: string, @Body() cambios: EditarTurnoDto) {
    return this.horarios.editarTurno(shiftId, cambios);
  }

  @Delete('turno/:shiftId')
  borrarTurno(@Param('shiftId') shiftId: string) {
    return this.horarios.borrarTurno(shiftId);
  }

  /** Publicar: recién ahí el equipo ve la semana en su teléfono. */
  @Post('publicar')
  publicar(@Body() body: { weekStart: string }) {
    return this.horarios.publicar(body.weekStart);
  }

  /** Rearma la semana desde el patrón sin pisar lo que ya está cargado. */
  @Post('generar')
  generar(@Body() body: { weekStart: string }) {
    return this.horarios.generarDesdePatron(body.weekStart);
  }

  // ---------------------------------------------------------------- patrón

  @Get('patron')
  verPatron() {
    return this.patron.porPersona();
  }

  @Post('patron')
  crearTramo(@Body() dto: TramoDto) {
    return this.patron.crearTramo(dto);
  }

  @Patch('patron/:id')
  editarTramo(@Param('id') id: string, @Body() cambios: Partial<TramoDto>) {
    return this.patron.actualizarTramo(id, cambios);
  }

  @Delete('patron/:id')
  borrarTramo(@Param('id') id: string) {
    return this.patron.borrarTramo(id);
  }

  /** Carga el horario inicial. No hace nada si el patrón ya tiene algo. */
  @Post('patron/sembrar')
  sembrar() {
    return this.patron.sembrarSiEstaVacio();
  }
}
