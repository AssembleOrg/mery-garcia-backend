import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Notificacion } from './entities/Notificacion.entity';
import { TipoNotificacion } from './whatsapp.enums';
import { WhatsappEventosService } from './whatsapp-eventos.service';

/** Cuánto vive una notificación. */
export const VIDA_NOTIFICACION_HORAS = 72;

export interface NotificacionDto {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  conversacionId: string | null;
  leida: boolean;
  createdAt: string;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

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
  ): Promise<void> {
    const n = await this.repo.save(
      this.repo.create({ tipo, titulo, cuerpo, conversacionId, leidaPor: [] }),
    );
    // Recién creada: nadie la leyó todavía, para todos es nueva.
    this.eventos.publicar('notificacion', this.aDto(n, ''));
  }

  async listar(usuarioId: string): Promise<NotificacionDto[]> {
    const desde = new Date(Date.now() - VIDA_NOTIFICACION_HORAS * 3_600_000);
    const filas = await this.repo.find({
      where: { createdAt: MoreThan(desde) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return filas.map((n) => this.aDto(n, usuarioId));
  }

  async marcarLeida(id: string, usuarioId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leidaPor: () => `array_append("leidaPor", :uid::uuid)` })
      .where('id = :id AND NOT (:uid::uuid = ANY("leidaPor"))', { id, uid: usuarioId })
      .setParameter('uid', usuarioId)
      .execute();
  }

  async marcarTodasLeidas(usuarioId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leidaPor: () => `array_append("leidaPor", :uid::uuid)` })
      .where('NOT (:uid::uuid = ANY("leidaPor"))')
      .setParameter('uid', usuarioId)
      .execute();
  }

  /** Cada hora se borran las que pasaron las 72 h. */
  @Cron('7 * * * *')
  async purgar(): Promise<void> {
    const limite = new Date(Date.now() - VIDA_NOTIFICACION_HORAS * 3_600_000);
    const r = await this.repo.delete({ createdAt: LessThan(limite) });
    if (r.affected) this.logger.log(`Notificaciones purgadas: ${r.affected}`);
  }

  private aDto(n: Notificacion, usuarioId: string): NotificacionDto {
    return {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      conversacionId: n.conversacionId,
      leida: Boolean(usuarioId) && n.leidaPor.includes(usuarioId),
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
    };
  }
}
