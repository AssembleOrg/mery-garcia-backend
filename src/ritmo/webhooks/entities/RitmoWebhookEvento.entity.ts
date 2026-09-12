import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Una entrega de webhook de Ritmo, tal como llegó.
 *
 * La clave primaria es el id que manda Ritmo, no uno nuestro: un reintento
 * repite el mismo id, así que insertarlo dos veces choca y ese choque es
 * justamente la idempotencia. Sin esto, un reintento contaría el mismo fichaje
 * dos veces.
 */
@Entity({ name: 'ritmo_webhook_evento' })
export class RitmoWebhookEvento {
  /** `id` de la entrega en Ritmo (deliveryId). */
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  evento: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Momento en que Ritmo generó la entrega. */
  @Column({ type: 'timestamptz', nullable: true })
  ocurridoEn: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  recibidoEn: Date;

  @Column({ type: 'timestamptz', nullable: true })
  procesadoEn: Date | null;
}
