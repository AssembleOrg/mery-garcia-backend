import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { TipoNotificacion } from '../whatsapp.enums';

/**
 * Aviso dentro del sistema. Semi persistente: una tarea las borra a las 72 h.
 * Van a todo el equipo que atiende; cada persona marca las suyas como leídas.
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

  /** Ids de Personal que ya la vieron. */
  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  leidaPor: string[];

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;
}
