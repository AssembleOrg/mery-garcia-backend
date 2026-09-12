import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RitmoService } from '../ritmo.service';
import { PatronService } from './patron.service';
import { AlternanciaTurno, PatronTurno } from './entities/PatronTurno.entity';
import { ANCLA_SEMANA_A } from './patron-semanal';
import {
  TZ_EMPRESA,
  diferenciaEnSemanas,
  lunesDeLaSemanaQueViene,
  sumarDias,
} from './fechas';

interface SemanaPlanificador {
  weekStart: string;
  rows: {
    userId: string | null;
    name: string;
    cells: Record<string, unknown[]>;
  }[];
  sites: { id: string; kind: string; name: string }[];
}

export interface ResumenGeneracion {
  weekStart: string;
  creados: number;
  yaEstaban: number;
  publicados: number;
  sinResolver: string[];
}

@Injectable()
export class TurnosService {
  private readonly logger = new Logger(TurnosService.name);

  constructor(
    private readonly ritmo: RitmoService,
    private readonly patron: PatronService,
  ) {}

  /**
   * Domingo a la noche: deja armada y publicada la semana que arranca mañana.
   * Se corre tarde a propósito, para que un cambio de último momento del sábado
   * ya esté contemplado.
   */
  @Cron('0 20 * * 0', { timeZone: TZ_EMPRESA })
  async generarSemanaQueViene(): Promise<void> {
    const semana = lunesDeLaSemanaQueViene();
    try {
      const resumen = await this.generarSemana(semana);
      this.logger.log(
        `Turnos ${semana}: ${resumen.creados} creados, ${resumen.yaEstaban} ya estaban, ${resumen.publicados} publicados`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo generar la semana ${semana}: ${(error as Error).message}`,
      );
    }
  }

  /** Semana A o B, para los tramos que alternan. */
  esSemanaA(weekStart: string): boolean {
    return Math.abs(diferenciaEnSemanas(ANCLA_SEMANA_A, weekStart)) % 2 === 0;
  }

  /**
   * Arma la semana desde el patrón y la publica. Es repetible: lo que ya está
   * cargado no se duplica, así que un turno corregido a mano sobrevive a la
   * siguiente corrida.
   */
  async generarSemana(weekStart: string): Promise<ResumenGeneracion> {
    const semana = (await this.ritmo.obtenerPlanificador(
      weekStart,
    )) as SemanaPlanificador;

    const sede =
      semana.sites.find((s) => s.kind === 'SEDE') ?? semana.sites[0] ?? null;
    if (!sede) {
      throw new Error('La empresa no tiene ninguna sede cargada en Ritmo.');
    }

    const tramos = this.tramosDeLaSemana(
      await this.patron.tramosActivos(),
      weekStart,
    );
    const ocupadas = new Map(
      semana.rows
        .filter((r) => r.userId)
        .map((r) => [r.userId as string, r.cells]),
    );

    const resumen: ResumenGeneracion = {
      weekStart,
      creados: 0,
      yaEstaban: 0,
      publicados: 0,
      sinResolver: [],
    };

    for (const tramo of tramos) {
      if (!ocupadas.has(tramo.ritmoUserId)) {
        // La persona ya no está en Ritmo (o quedó inactiva): se avisa una vez
        // y su tramo se saltea, en vez de romper toda la generación.
        if (!resumen.sinResolver.includes(tramo.nombre)) {
          resumen.sinResolver.push(tramo.nombre);
          this.logger.warn(`${tramo.nombre} no aparece en Ritmo: se saltea`);
        }
        continue;
      }

      const dia = sumarDias(weekStart, tramo.diaIso - 1);
      const celdas = ocupadas.get(tramo.ritmoUserId) ?? {};

      // Ya hay algo ese día para esa persona: no se pisa.
      if ((celdas[dia]?.length ?? 0) > 0) {
        resumen.yaEstaban += 1;
        continue;
      }

      await this.ritmo.crearTurnos({
        userId: tramo.ritmoUserId,
        day: dia,
        worksiteId: sede.id,
        startsMinute: tramo.desdeMinuto,
        endsMinute: tramo.hastaMinuto,
        breakMinutes: tramo.pausaMinutos,
        templateId: null,
      });
      resumen.creados += 1;

      // Se marca la celda para que dos tramos del mismo día no se pisen entre sí.
      celdas[dia] = [...(celdas[dia] ?? []), { generado: true }];
    }

    const publicado = await this.ritmo.publicarSemana(weekStart);
    resumen.publicados = publicado?.published ?? 0;
    return resumen;
  }

  /** Los tramos que corren esa semana, resolviendo la alternancia A/B. */
  private tramosDeLaSemana(
    tramos: PatronTurno[],
    weekStart: string,
  ): PatronTurno[] {
    const esA = this.esSemanaA(weekStart);
    return tramos.filter(
      (t) =>
        t.alternancia === AlternanciaTurno.TODAS ||
        (esA
          ? t.alternancia === AlternanciaTurno.SEMANA_A
          : t.alternancia === AlternanciaTurno.SEMANA_B),
    );
  }
}
