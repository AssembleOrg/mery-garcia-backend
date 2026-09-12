import { Controller, Get, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RitmoService } from './ritmo.service';
import { EventosService, MensajeSse } from './eventos/eventos.service';

/**
 * Presentismo, y sólo presentismo: quién está, quién falta y las horas de la
 * semana. Todo de lectura.
 *
 * El resto de Ritmo (personal, planificador, incidencias, licencias,
 * liquidación) queda fuera de la app a propósito: se gestiona desde la consola
 * de Ritmo. Los turnos los carga el cron de TurnosService, no un endpoint.
 */
@Controller('ritmo')
export class RitmoController {
  constructor(
    private readonly ritmo: RitmoService,
    private readonly eventos: EventosService,
  ) {}

  /** Tablero de ahora: quién está fichado, quién llega tarde, quién falta. */
  @Get('hoy')
  hoy() {
    return this.ritmo.consolaHoy();
  }

  /**
   * Pantalla en vivo: se emite un evento apenas alguien entra o sale.
   *
   * El evento trae el detalle para poder mostrar un aviso, pero la pantalla
   * debería releer `GET /api/ritmo/hoy` al recibirlo: así queda bien aunque se
   * haya perdido algún evento por una reconexión.
   */
  @Sse('eventos')
  streamEventos(): Observable<MensajeSse> {
    return this.eventos.stream();
  }

  /** Asistencia de la semana. `desde` = lunes (YYYY-MM-DD); sin él, la actual. */
  @Get('semana')
  semana(@Query('desde') desde?: string) {
    return this.ritmo.consolaSemana(desde);
  }

  /** Equipo con sus horas y llegadas tarde. Sólo lectura: no da de alta ni edita. */
  @Get('personal')
  personal() {
    return this.ritmo.listarPersonal();
  }
}
