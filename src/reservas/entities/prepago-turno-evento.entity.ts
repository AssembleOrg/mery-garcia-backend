import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PrepagoGuardado } from '../../personal/entities/PrepagoGuardado.entity';

/**
 * Historial del turno al que apunta una seña de reserva online: cuándo se
 * creó, cada reprogramación (fecha, servicio o profesional) y la cancelación,
 * con el antes y el después y quién lo hizo. Lo manda booking; acá solo se
 * guarda para análisis (no se muestra en pantalla).
 *
 * tipo: CREADA | REPROGRAMADA | CANCELADA | ESTADO_INICIAL (carga inicial).
 * origen: CLIENTA (web pública) | ADMIN (panel de booking) | SISTEMA.
 */
@Entity({ name: 'prepago_turno_eventos' })
export class PrepagoTurnoEvento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PrepagoGuardado, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prepago_id' })
  prepago?: PrepagoGuardado | null;

  @Index('ix_turno_evento_booking')
  @Column({ type: 'varchar', length: 80 })
  bookingId: string;

  /** Id del evento en booking: llave de idempotencia (un reintento no duplica). */
  @Index('ux_turno_evento_evento_id', { unique: true })
  @Column({ type: 'varchar', length: 80 })
  eventoId: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: string;

  @Column({ type: 'varchar', length: 20 })
  origen: string;

  /** Quién lo hizo: usuario del panel o nombre de la clienta. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  actor?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaTurnoAnterior?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaTurnoNueva?: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  servicioIdAnterior?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  servicioIdNuevo?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  servicioAnterior?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  servicioNuevo?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  empleadoAnterior?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  empleadoNuevo?: string | null;

  /** Estado de la reserva en booking después del evento (CONFIRMED, CANCELLED…). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  estadoReserva?: string | null;

  /** Cuándo pasó en booking (puede llegar más tarde si hubo reintentos). */
  @Column({ type: 'timestamptz' })
  ocurridoEn: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  recibidoEn: Date;
}
