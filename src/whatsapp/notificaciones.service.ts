import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { Notificacion } from './entities/Notificacion.entity';
import { TipoNotificacion } from './whatsapp.enums';
import { WhatsappEventosService } from './whatsapp-eventos.service';

/** Cuánto vive una notificación. */
export const VIDA_NOTIFICACION_HORAS = 72;

const LATIDO_MS = 25_000;

export interface NotificacionDto {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  conversacionId: string | null;
  enlace: string | null;
  leida: boolean;
  createdAt: string;
}

export interface OpcionesNotificacion {
  /** Sólo para esta persona (Personal.id). Sin esto, va a todo el equipo. */
  destinatarioId?: string | null;
  /** Ruta de la web a la que lleva el aviso. */
  enlace?: string | null;
}

/** Lo que recibe por SSE quien escucha sus avisos personales. */
export interface EventoPersonal {
  type: 'notificacion' | 'ping';
  data: unknown;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  /** Avisos con destinatario: cada stream se queda con los suyos. */
  private readonly personales = new Subject<{
    destinatarioId: string;
    dto: NotificacionDto;
  }>();

  constructor(
    @InjectRepository(Notificacion)
    private readonly repo: Repository<Notificacion>,
    private readonly eventos: WhatsappEventosService,
  ) {}

  async crear(
    tipo: TipoNotificacion,
    titulo: string,
    cuerpo: string,
    conversacionId: string | null,
    opciones: OpcionesNotificacion = {},
  ): Promise<NotificacionDto> {
    const destinatarioId = opciones.destinatarioId ?? null;
    const n = await this.repo.save(
      this.repo.create({
        tipo,
        titulo,
        cuerpo,
        conversacionId,
        destinatarioId,
        enlace: opciones.enlace ?? null,
        leidaPor: [],
      }),
    );
    // Recién creada: nadie la leyó todavía, para todos es nueva.
    const dto = this.aDto(n, '');
    if (destinatarioId) this.personales.next({ destinatarioId, dto });
    else this.eventos.publicar('notificacion', dto);
    return dto;
  }

  /** Las del equipo (sin destinatario). */
  async listar(usuarioId: string): Promise<NotificacionDto[]> {
    const filas = await this.repo.find({
      where: { createdAt: MoreThan(this.desde()), destinatarioId: IsNull() },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return filas.map((n) => this.aDto(n, usuarioId));
  }

  /** Las dirigidas a esta persona. */
  async listarMias(usuarioId: string): Promise<NotificacionDto[]> {
    const filas = await this.repo.find({
      where: { createdAt: MoreThan(this.desde()), destinatarioId: usuarioId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return filas.map((n) => this.aDto(n, usuarioId));
  }

  /** En vivo, sólo los avisos de esta persona (más un latido para no cortar). */
  streamMias(usuarioId: string): Observable<EventoPersonal> {
    const propios = this.personales.pipe(
      filter((e) => e.destinatarioId === usuarioId),
      map((e): EventoPersonal => ({ type: 'notificacion', data: e.dto })),
    );
    const latidos = interval(LATIDO_MS).pipe(
      map(
        (): EventoPersonal => ({
          type: 'ping',
          data: { ts: new Date().toISOString() },
        }),
      ),
    );
    return merge(propios, latidos);
  }

  /** Sólo puede marcar las del equipo o las suyas. */
  async marcarLeida(id: string, usuarioId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leidaPor: () => `array_append("leidaPor", :uid::uuid)` })
      .where('id = :id AND NOT (:uid::uuid = ANY("leidaPor"))', {
        id,
        uid: usuarioId,
      })
      .andWhere('("destinatarioId" IS NULL OR "destinatarioId" = :uid::uuid)')
      .setParameter('uid', usuarioId)
      .execute();
  }

  async marcarTodasLeidas(usuarioId: string, soloMias = false): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leidaPor: () => `array_append("leidaPor", :uid::uuid)` })
      .where('NOT (:uid::uuid = ANY("leidaPor"))')
      .andWhere(
        soloMias ? '"destinatarioId" = :uid::uuid' : '"destinatarioId" IS NULL',
      )
      .setParameter('uid', usuarioId)
      .execute();
  }

  /** Cada hora se borran las que pasaron las 72 h. */
  @Cron('7 * * * *')
  async purgar(): Promise<void> {
    const r = await this.repo.delete({ createdAt: LessThan(this.desde()) });
    if (r.affected) this.logger.log(`Notificaciones purgadas: ${r.affected}`);
  }

  private desde(): Date {
    return new Date(Date.now() - VIDA_NOTIFICACION_HORAS * 3_600_000);
  }

  private aDto(n: Notificacion, usuarioId: string): NotificacionDto {
    return {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      conversacionId: n.conversacionId,
      enlace: n.enlace ?? null,
      leida: Boolean(usuarioId) && n.leidaPor.includes(usuarioId),
      createdAt:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : String(n.createdAt),
    };
  }
}
