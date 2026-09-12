import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';
import { RitmoService } from '../ritmo.service';
import type { FichajeRegistrado } from '../webhooks/webhooks.service';

export interface EventoPresentismo {
  tipo: 'fichaje';
  userId: string;
  nombre: string | null;
  kind: string;
  /** true cuando la marca deja a la persona adentro. */
  presente: boolean;
  happenedAt: string;
  aRevisar: boolean;
  motivo: string | null;
}

/** Sobre de SSE: lo que el navegador recibe en cada mensaje. */
export interface MensajeSse {
  type: string;
  data: EventoPresentismo | { ts: string };
}

/** Cada cuánto se manda un latido para que un proxy no corte la conexión. */
const LATIDO_MS = 25_000;

interface PersonalRitmo {
  people: { id: string; fullName: string }[];
}

/**
 * Bus de presentismo en vivo. El webhook de Ritmo publica acá y la pantalla
 * escucha por SSE, así se actualiza sola cuando alguien entra o sale.
 *
 * El bus vive en memoria: si el backend corre en más de una réplica, cada una
 * sólo avisa a las pantallas conectadas a ella. Para una sola instancia, que es
 * el caso, alcanza.
 */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);
  private readonly bus = new Subject<EventoPresentismo>();
  /** userId → nombre. El webhook manda el id, la pantalla quiere el nombre. */
  private nombres = new Map<string, string>();

  constructor(private readonly ritmo: RitmoService) {}

  /**
   * Lo que consume `@Sse`. Mezcla los eventos reales con un latido periódico:
   * sin tráfico, un proxy corta una conexión abierta y la pantalla se queda
   * muda sin que nadie se entere.
   */
  stream(): Observable<MensajeSse> {
    const eventos = this.bus.pipe(
      map((evento): MensajeSse => ({ type: 'fichaje', data: evento })),
    );
    const latidos = interval(LATIDO_MS).pipe(
      map((): MensajeSse => ({
        type: 'ping',
        data: { ts: new Date().toISOString() },
      })),
    );
    return merge(eventos, latidos);
  }

  /** Publica un fichaje recién llegado por webhook. */
  async publicarFichaje(marca: FichajeRegistrado): Promise<void> {
    this.bus.next({
      tipo: 'fichaje',
      userId: marca.userId,
      nombre: await this.nombreDe(marca.userId),
      kind: marca.kind,
      presente: marca.kind === 'ENTRADA' || marca.kind === 'PAUSA_FIN',
      happenedAt: marca.happenedAt,
      aRevisar: marca.review === 'PENDIENTE',
      motivo: marca.reviewReason,
    });
  }

  /** Nombre de la persona, releyendo el personal sólo si el id es nuevo. */
  private async nombreDe(userId: string): Promise<string | null> {
    const conocido = this.nombres.get(userId);
    if (conocido) return conocido;

    try {
      const personal = (await this.ritmo.listarPersonal()) as PersonalRitmo;
      this.nombres = new Map(personal.people.map((p) => [p.id, p.fullName]));
    } catch (error) {
      // Sin nombre igual se avisa: la pantalla se refresca lo mismo.
      this.logger.warn(
        `No se pudo resolver el nombre de ${userId}: ${(error as Error).message}`,
      );
    }
    return this.nombres.get(userId) ?? null;
  }
}
