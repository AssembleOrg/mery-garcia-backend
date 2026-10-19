import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * Un navegador o celular que aceptó recibir notificaciones push. Una persona
 * puede tener varias (compu de recepción, su iPhone…). Si el servicio de push
 * avisa que la suscripción ya no existe (404/410), se borra sola.
 */
@Entity({ name: 'push_suscripcion' })
export class PushSuscripcion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Personal.id dueño de la suscripción. */
  @Index('ix_push_suscripcion_personal')
  @Column({ type: 'uuid' })
  personalId: string;

  @Index('uq_push_suscripcion_endpoint', { unique: true })
  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'varchar', length: 200 })
  p256dh: string;

  @Column({ type: 'varchar', length: 100 })
  auth: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;
}
