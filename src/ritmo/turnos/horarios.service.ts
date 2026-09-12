import { BadRequestException, Injectable } from '@nestjs/common';
import { RitmoService } from '../ritmo.service';
import { TurnosService } from './turnos.service';
import { diaIso } from './fechas';

export interface CrearTurnoDto {
  userId: string;
  /** YYYY-MM-DD */
  day: string;
  desdeMinuto: number;
  hastaMinuto: number;
  pausaMinutos?: number;
  worksiteId?: string | null;
}

export interface EditarTurnoDto {
  /** Mover a otro día. */
  day?: string;
  /** Pasarle el turno a otra persona. */
  userId?: string;
  /** Cambiar el horario: obliga a rehacer el turno (ver abajo). */
  desdeMinuto?: number;
  hastaMinuto?: number;
  pausaMinutos?: number;
  worksiteId?: string | null;
}

interface SemanaPlanificador {
  weekStart: string;
  rows: {
    userId: string | null;
    name: string;
    cells: Record<string, TurnoCelda[]>;
  }[];
  sites: { id: string; kind: string; name: string }[];
}

interface TurnoCelda {
  id: string;
  userId: string;
  worksiteId: string | null;
  day: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  breakMinutes: number;
  published: boolean;
}

/**
 * Los turnos de una semana concreta: mirarlos y corregirlos día por día.
 *
 * Es la capa de "excepción": tocar acá cambia ese día y nada más. El horario
 * que se repite todas las semanas se edita en el patrón (PatronService).
 */
@Injectable()
export class HorariosService {
  constructor(
    private readonly ritmo: RitmoService,
    private readonly turnos: TurnosService,
  ) {}

  /** La grilla de la semana, más si es semana A o B (por los turnos que alternan). */
  async semana(desde: string): Promise<unknown> {
    this.exigirLunes(desde);
    const semana = (await this.ritmo.obtenerPlanificador(desde)) as SemanaPlanificador;
    return { ...semana, esSemanaA: this.turnos.esSemanaA(desde) };
  }

  async crearTurno(dto: CrearTurnoDto): Promise<unknown> {
    this.exigirRango(dto.desdeMinuto, dto.hastaMinuto);
    return this.ritmo.crearTurnos({
      userId: dto.userId,
      day: dto.day,
      worksiteId: dto.worksiteId ?? (await this.sedePorDefecto(dto.day)),
      startsMinute: dto.desdeMinuto,
      endsMinute: dto.hastaMinuto,
      breakMinutes: dto.pausaMinutos ?? 0,
      templateId: null,
    });
  }

  /**
   * Edita un turno.
   *
   * Ritmo sólo sabe mover un turno de día o de persona; el horario no se puede
   * editar en el lugar. Así que cuando cambia la hora, el turno se borra y se
   * vuelve a crear con los datos nuevos. Para quien mira la pantalla es lo
   * mismo, pero el turno pasa a tener otro id.
   */
  async editarTurno(shiftId: string, cambios: EditarTurnoDto): Promise<unknown> {
    const cambiaHorario =
      cambios.desdeMinuto !== undefined ||
      cambios.hastaMinuto !== undefined ||
      cambios.pausaMinutos !== undefined;

    if (!cambiaHorario) {
      return this.ritmo.moverTurno(shiftId, {
        day: cambios.day,
        userId: cambios.userId,
      });
    }

    const actual = await this.buscarTurno(shiftId, cambios.day);
    if (!actual) {
      throw new BadRequestException('No se encontró ese turno en la semana.');
    }

    const desdeMinuto = cambios.desdeMinuto ?? this.minutosDe(actual.startsAt, actual.day);
    const hastaMinuto = cambios.hastaMinuto ?? this.minutosDe(actual.endsAt, actual.day);
    this.exigirRango(desdeMinuto, hastaMinuto);

    await this.ritmo.borrarTurno(shiftId);
    return this.ritmo.crearTurnos({
      userId: cambios.userId ?? actual.userId,
      day: cambios.day ?? actual.day,
      worksiteId: cambios.worksiteId ?? actual.worksiteId,
      startsMinute: desdeMinuto,
      endsMinute: hastaMinuto,
      breakMinutes: cambios.pausaMinutos ?? actual.breakMinutes,
      templateId: null,
    });
  }

  borrarTurno(shiftId: string): Promise<unknown> {
    return this.ritmo.borrarTurno(shiftId);
  }

  /** Publicar es lo que hace que la gente vea la semana en su teléfono. */
  publicar(weekStart: string): Promise<{ published: number }> {
    this.exigirLunes(weekStart);
    return this.ritmo.publicarSemana(weekStart);
  }

  /** Rearma la semana desde el patrón, sin pisar lo que ya está cargado. */
  generarDesdePatron(weekStart: string) {
    this.exigirLunes(weekStart);
    return this.turnos.generarSemana(weekStart);
  }

  // ------------------------------------------------------------------ apoyo

  private async buscarTurno(shiftId: string, dia?: string): Promise<TurnoCelda | null> {
    // El turno se busca en su propia semana: sin `day` no hay forma de saber
    // cuál pedir, así que se prueba con la semana del día que mandaron.
    const referencia = dia ?? new Date().toISOString().slice(0, 10);
    const lunes = this.lunesDe(referencia);
    const semana = (await this.ritmo.obtenerPlanificador(lunes)) as SemanaPlanificador;

    for (const fila of semana.rows) {
      for (const celdas of Object.values(fila.cells)) {
        const encontrado = celdas.find((c) => c.id === shiftId);
        if (encontrado) return encontrado;
      }
    }
    return null;
  }

  private async sedePorDefecto(dia: string): Promise<string | null> {
    const semana = (await this.ritmo.obtenerPlanificador(
      this.lunesDe(dia),
    )) as SemanaPlanificador;
    const sede = semana.sites.find((s) => s.kind === 'SEDE') ?? semana.sites[0];
    return sede?.id ?? null;
  }

  /** Minutos desde la medianoche del propio día del turno, en su zona. */
  private minutosDe(instanteIso: string, dia: string): number {
    const inicioDelDia = new Date(`${dia}T00:00:00.000Z`).getTime();
    const instante = new Date(instanteIso).getTime();
    // startsAt viene en UTC y `day` es el día local; la diferencia entre ambos
    // ya incluye el huso, así que se normaliza contra el propio día del turno.
    const minutos = Math.round((instante - inicioDelDia) / 60_000);
    return ((minutos % 1440) + 1440) % 1440;
  }

  private lunesDe(dia: string): string {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (diaIso(dia) - 1));
    return d.toISOString().slice(0, 10);
  }

  private exigirLunes(dia: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      throw new BadRequestException(`Fecha inválida: ${dia}. Se espera YYYY-MM-DD.`);
    }
    if (diaIso(dia) !== 1) {
      throw new BadRequestException(`${dia} no es lunes: la semana arranca el lunes.`);
    }
  }

  private exigirRango(desde: number, hasta: number): void {
    if (desde < 0 || desde > 1439 || hasta < 1 || hasta > 1560) {
      throw new BadRequestException('Horario fuera de rango.');
    }
    if (hasta <= desde) {
      throw new BadRequestException('La salida tiene que ser posterior a la entrada.');
    }
  }
}
