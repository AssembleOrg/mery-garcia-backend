import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RitmoService } from '../ritmo.service';
import { AlternanciaTurno, PatronTurno } from './entities/PatronTurno.entity';
import { PAUSA_MINUTOS, SEMILLA_PATRON } from './patron-semanal';
import { aMinutos } from './fechas';

export interface TramoDto {
  ritmoUserId: string;
  diaIso: number;
  desdeMinuto: number;
  hastaMinuto: number;
  pausaMinutos?: number;
  alternancia?: AlternanciaTurno;
  activo?: boolean;
}

export interface PatronDePersona {
  ritmoUserId: string;
  nombre: string;
  tramos: PatronTurno[];
  /** Horas semanales que suma el patrón, contando las semanas A y B aparte. */
  horasSemanaA: number;
  horasSemanaB: number;
}

interface PersonalRitmo {
  people: { id: string; fullName: string; email: string; role: string; isActive: boolean }[];
}

/** El horario fijo del equipo: leerlo, editarlo y sembrarlo la primera vez. */
@Injectable()
export class PatronService {
  private readonly logger = new Logger(PatronService.name);

  constructor(
    @InjectRepository(PatronTurno)
    private readonly repo: Repository<PatronTurno>,
    private readonly ritmo: RitmoService,
  ) {}

  /** Tramos activos de la semana, para el generador. */
  tramosActivos(): Promise<PatronTurno[]> {
    return this.repo.find({
      where: { activo: true },
      order: { diaIso: 'ASC', desdeMinuto: 'ASC' },
    });
  }

  /** El patrón agrupado por persona, que es como lo muestra la pantalla. */
  async porPersona(): Promise<PatronDePersona[]> {
    const tramos = await this.repo.find({
      order: { nombre: 'ASC', diaIso: 'ASC', desdeMinuto: 'ASC' },
    });

    const porId = new Map<string, PatronDePersona>();
    for (const tramo of tramos) {
      let persona = porId.get(tramo.ritmoUserId);
      if (!persona) {
        persona = {
          ritmoUserId: tramo.ritmoUserId,
          nombre: tramo.nombre,
          tramos: [],
          horasSemanaA: 0,
          horasSemanaB: 0,
        };
        porId.set(tramo.ritmoUserId, persona);
      }
      persona.tramos.push(tramo);

      if (!tramo.activo) continue;
      const horas = (tramo.hastaMinuto - tramo.desdeMinuto - tramo.pausaMinutos) / 60;
      if (tramo.alternancia !== AlternanciaTurno.SEMANA_B) persona.horasSemanaA += horas;
      if (tramo.alternancia !== AlternanciaTurno.SEMANA_A) persona.horasSemanaB += horas;
    }

    return [...porId.values()].map((p) => ({
      ...p,
      horasSemanaA: Number(p.horasSemanaA.toFixed(2)),
      horasSemanaB: Number(p.horasSemanaB.toFixed(2)),
    }));
  }

  async crearTramo(dto: TramoDto): Promise<PatronTurno> {
    const nombre = await this.nombreDe(dto.ritmoUserId);
    this.validar(dto);
    return this.repo.save(
      this.repo.create({
        ritmoUserId: dto.ritmoUserId,
        nombre,
        diaIso: dto.diaIso,
        desdeMinuto: dto.desdeMinuto,
        hastaMinuto: dto.hastaMinuto,
        pausaMinutos: dto.pausaMinutos ?? PAUSA_MINUTOS,
        alternancia: dto.alternancia ?? AlternanciaTurno.TODAS,
        activo: dto.activo ?? true,
      }),
    );
  }

  async actualizarTramo(id: string, cambios: Partial<TramoDto>): Promise<PatronTurno> {
    const tramo = await this.repo.findOne({ where: { id } });
    if (!tramo) throw new NotFoundException(`No existe el tramo ${id}`);

    Object.assign(tramo, {
      diaIso: cambios.diaIso ?? tramo.diaIso,
      desdeMinuto: cambios.desdeMinuto ?? tramo.desdeMinuto,
      hastaMinuto: cambios.hastaMinuto ?? tramo.hastaMinuto,
      pausaMinutos: cambios.pausaMinutos ?? tramo.pausaMinutos,
      alternancia: cambios.alternancia ?? tramo.alternancia,
      activo: cambios.activo ?? tramo.activo,
    });
    this.validar(tramo);
    return this.repo.save(tramo);
  }

  async borrarTramo(id: string): Promise<void> {
    const borrado = await this.repo.delete({ id });
    if (!borrado.affected) throw new NotFoundException(`No existe el tramo ${id}`);
  }

  private validar(tramo: {
    diaIso: number;
    desdeMinuto: number;
    hastaMinuto: number;
    pausaMinutos?: number;
  }): void {
    if (tramo.diaIso < 1 || tramo.diaIso > 7) {
      throw new BadRequestException('El día tiene que ir de 1 (lunes) a 7 (domingo).');
    }
    if (tramo.desdeMinuto < 0 || tramo.desdeMinuto > 1439 || tramo.hastaMinuto > 1560) {
      throw new BadRequestException('Horario fuera de rango.');
    }
    if (tramo.hastaMinuto <= tramo.desdeMinuto) {
      throw new BadRequestException('La hora de salida tiene que ser posterior a la de entrada.');
    }
  }

  private async nombreDe(ritmoUserId: string): Promise<string> {
    const personal = (await this.ritmo.listarPersonal()) as PersonalRitmo;
    const persona = personal.people.find((p) => p.id === ritmoUserId);
    if (!persona) throw new NotFoundException(`Esa persona no existe en Ritmo.`);
    return persona.fullName;
  }

  /**
   * Carga el horario inicial la primera vez. Si ya hay algo cargado no toca
   * nada: a partir de la siembra, el patrón lo manda la base.
   */
  async sembrarSiEstaVacio(): Promise<{ sembrado: boolean; tramos: number }> {
    const existentes = await this.repo.count();
    if (existentes > 0) return { sembrado: false, tramos: existentes };

    const personal = (await this.ritmo.listarPersonal()) as PersonalRitmo;
    const porEmail = new Map(personal.people.map((p) => [p.email.toLowerCase(), p]));

    const filas: PatronTurno[] = [];
    for (const semilla of SEMILLA_PATRON) {
      const persona = porEmail.get(semilla.email.toLowerCase());
      if (!persona) {
        this.logger.warn(`${semilla.nombre} (${semilla.email}) no existe en Ritmo: se saltea`);
        continue;
      }
      for (const tramo of semilla.tramos) {
        filas.push(
          this.repo.create({
            ritmoUserId: persona.id,
            nombre: persona.fullName,
            diaIso: tramo.dia,
            desdeMinuto: aMinutos(tramo.desde),
            hastaMinuto: aMinutos(tramo.hasta),
            pausaMinutos: PAUSA_MINUTOS,
            alternancia: tramo.alternancia ?? AlternanciaTurno.TODAS,
            activo: true,
          }),
        );
      }
    }

    await this.repo.save(filas);
    this.logger.log(`Patrón sembrado: ${filas.length} tramos`);
    return { sembrado: true, tramos: filas.length };
  }
}
