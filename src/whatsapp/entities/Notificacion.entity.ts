import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { TipoNotificacion } from '../whatsapp.enums';

/**
 * Aviso dentro del sistema. Semi persistente: una tarea las borra a las 72 h.
 * Sin destinatario van a todo el equipo que atiende (admin y encargada); con
 * destinatario, sólo a esa persona (p. ej. un empleado). Cada uno marca las
 * suyas como leídas.
 */
@Entity({ name: 'notificacion' })
@Index('ix_notificacion_created', ['createdAt'])
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoNotificacion, enumName: 'notificacion_tipo_enum' })
  tipo: TipoNotificacion;

  @Column({ type: 'varchar', length: 160 })
  titulo: string;

  @Column({ type: 'text' })
  cuerpo: string;

  @Column({ type: 'uuid', nullable: true })
  conversacionId: string | null;

  /** Personal que la recibe. Null = todo el equipo. */
  @Index('ix_notificacion_destinatario')
  @Column({ type: 'uuid', nullable: true })
  destinatarioId: string | null;

  /** Ruta de la web a la que lleva el aviso (p. ej. /control-stock). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  enlace: string | null;

  /** Ids de Personal que ya la vieron. */
  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  leidaPor: string[];

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;
}
