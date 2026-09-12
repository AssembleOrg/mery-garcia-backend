import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RitmoWebhookEvento } from './entities/RitmoWebhookEvento.entity';
import { verificarFirmaRitmo } from './firma';

/** Sobre de una entrega de Ritmo. */
export interface EntregaRitmo {
  id: string;
  event: string;
  createdAt: string;
  attempt: number;
  organizationId: string;
  data: Record<string, unknown>;
}

/** `data` de fichaje.registrado. */
export interface FichajeRegistrado {
  punchId: string;
  userId: string;
  kind: string;
  happenedAt: string;
  review: 'VALIDO' | 'PENDIENTE';
  reviewReason: string | null;
  worksiteId: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  via: string | null;
}

@Injectable()
export class RitmoWebhooksService {
  private readonly logger = new Logger(RitmoWebhooksService.name);
  private readonly secreto?: string;

  constructor(
    config: ConfigService,
    @InjectRepository(RitmoWebhookEvento)
    private readonly repo: Repository<RitmoWebhookEvento>,
  ) {
    this.secreto = config.get<string>('ritmo.webhookSecret');
  }

  get configurado(): boolean {
    return Boolean(this.secreto);
  }

  verificar(cabecera: string | undefined, cuerpoCrudo: string): boolean {
    if (!this.secreto) return false;
    return verificarFirmaRitmo(this.secreto, cabecera, cuerpoCrudo);
  }

  /**
   * Guarda la entrega si es nueva. Devuelve false cuando ya estaba: es un
   * reintento de Ritmo y no hay que volver a procesarla.
   */
  async registrar(entrega: EntregaRitmo): Promise<boolean> {
    const resultado = await this.repo
      .createQueryBuilder()
      .insert()
      .into(RitmoWebhookEvento)
      // El cast es sólo para el jsonb: TypeORM no sabe tipar una columna de
      // forma libre. El insert sigue siendo parametrizado.
      .values({
        id: entrega.id,
        evento: entrega.event,
        payload: (entrega.data ?? {}) as RitmoWebhookEvento['payload'],
        ocurridoEn: entrega.createdAt ? new Date(entrega.createdAt) : null,
        procesadoEn: null,
      } as QueryDeepPartialEntity<RitmoWebhookEvento>)
      .orIgnore()
      .execute();

    return resultado.raw.length > 0;
  }

  /**
   * Reacción a la entrega. Corre fuera del request: Ritmo espera un 2xx en
   * menos de 10 segundos y reintenta si tarda.
   */
  async procesar(entrega: EntregaRitmo): Promise<void> {
    try {
      switch (entrega.event) {
        case 'fichaje.registrado':
          this.alFichar(entrega.data as unknown as FichajeRegistrado);
          break;
        case 'webhook.prueba':
          this.logger.log(`Webhook de prueba recibido: ${entrega.id}`);
          break;
        default:
          this.logger.log(`Evento ${entrega.event} recibido (sin reacción)`);
      }
      await this.repo.update({ id: entrega.id }, { procesadoEn: new Date() });
    } catch (error) {
      // No se re-lanza: la entrega ya está guardada y el 2xx ya salió. Si se
      // propagara, Ritmo reintentaría y el dedupe lo descartaría igual.
      this.logger.error(
        `Fallo procesando ${entrega.event} ${entrega.id}: ${(error as Error).message}`,
      );
    }
  }

  private alFichar(marca: FichajeRegistrado): void {
    const detalle = `${marca.kind} de ${marca.userId} a las ${marca.happenedAt}`;
    if (marca.review === 'PENDIENTE') {
      this.logger.warn(`Fichaje a revisar: ${detalle} — ${marca.reviewReason}`);
      return;
    }
    this.logger.log(`Fichaje: ${detalle}`);
  }
}
