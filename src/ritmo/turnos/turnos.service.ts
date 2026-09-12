import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RitmoService } from '../ritmo.service';
import {
  ANCLA_SABADO_LARGO,
  BREAK_MINUTES,
  PATRON_SEMANAL,
  type PatronPersona,
  type TramoTurno,
} from './patron-semanal';
import {
  TZ_EMPRESA,
  aMinutos,
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

interface PersonalRitmo {
  people: { id: string; email: string; fullName: string }[];
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

  constructor(private readonly ritmo: RitmoService) {}

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

  /**
   * Arma la semana desde el patrón fijo y la publica. Es repetible: lo que ya
   * está cargado no se duplica, así se puede volver a correr sin miedo.
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

    const personal = (await this.ritmo.listarPersonal()) as PersonalRitmo;
    const porEmail = new Map(
      personal.people.map((p) => [p.email.toLowerCase(), p.id]),
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

    for (const persona of PATRON_SEMANAL) {
      const userId = porEmail.get(persona.email.toLowerCase());
      if (!userId) {
        resumen.sinResolver.push(persona.email);
        this.logger.warn(
          `${persona.nombre} (${persona.email}) no existe en Ritmo: se saltea`,
        );
        continue;
      }

      const celdas = ocupadas.get(userId) ?? {};

      for (const tramo of this.tramosDeLaSemana(persona, weekStart)) {
        const dia = sumarDias(weekStart, tramo.dia - 1);

        // Ya hay algo cargado ese día para esa persona: no se pisa. Si alguien
        // ajustó el turno a mano, el generador lo respeta.
        if ((celdas[dia]?.length ?? 0) > 0) {
          resumen.yaEstaban += 1;
          continue;
        }

        await this.ritmo.crearTurnos({
          userId,
          day: dia,
          worksiteId: sede.id,
          startsMinute: aMinutos(tramo.desde),
          endsMinute: aMinutos(tramo.hasta),
          breakMinutes: BREAK_MINUTES,
          templateId: null,
        });
        resumen.creados += 1;
      }
    }

    const publicado = await this.ritmo.publicarSemana(weekStart);
    resumen.publicados = publicado?.published ?? 0;
    return resumen;
  }

  /**
   * Los tramos de esa semana. El sábado por medio se resuelve acá: en las
   * semanas del medio el turno alterno reemplaza al del mismo día.
   */
  private tramosDeLaSemana(
    persona: PatronPersona,
    weekStart: string,
  ): TramoTurno[] {
    if (!persona.alterna) return persona.tramos;

    const anclaLunes = sumarDias(ANCLA_SABADO_LARGO, -5);
    const esSemanaLarga =
      Math.abs(diferenciaEnSemanas(anclaLunes, weekStart)) % 2 === 0;
    if (esSemanaLarga) return persona.tramos;

    const { dia, desde, hasta } = persona.alterna;
    return persona.tramos.map((tramo) =>
      tramo.dia === dia ? { dia, desde, hasta } : tramo,
    );
  }
}
