// src/modules/prepago-guardado/entities/prepago-guardado.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Cliente } from '../../cliente/entities/Cliente.entity';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { TipoPago } from 'src/enums/TipoPago.enum';
import { TipoMovimiento } from 'src/enums/TipoMovimiento.enum';
import { Movimiento } from 'src/comanda/entities/movimiento.entity';



@Entity({ name: 'prepagos_guardados' })
export class PrepagoGuardado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monto: number;

  @Column({ type: 'enum', enum: TipoMoneda })
  moneda: TipoMoneda;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  fechaCreacion: Date;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  fechaVencimiento?: Date;

  @Column({ type: 'enum', enum: EstadoPrepago })
  estado: EstadoPrepago;

  @Column({ default: '' })
  observaciones: string;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  deletedAt?: Date;

  @ManyToOne(() => Cliente, cliente => cliente.prepagosGuardados, {
    eager: false,
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;


  @Column({ type: 'enum', enum: TipoPago })
  tipoPago: TipoPago;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  montoTraspasado?: number;

  @Column({ type: 'enum', enum: TipoMovimiento, nullable: true })
  tipoMovimiento?: TipoMovimiento;

  // ─── Reserva de origen (booking) ──────────────────────────────────────
  // Se completan solo cuando la seña entró automáticamente desde una reserva
  // pagada por Mercado Pago en el sistema de turnos. Las señas cargadas a mano
  // (efectivo en el local, etc.) los dejan en null.

  /** Servicio tal como se reservó en booking (nombre real, puede ser un combo). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  servicioReservado?: string;

  /** Profesional con la que se reservó (nombre). Informativo para el reporte. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  empleadoReservado?: string;

  /**
   * Id de la reserva en booking. Es la llave de idempotencia: una misma reserva
   * no crea dos señas. Único, pero admite muchos null (las señas manuales).
   */
  @Index('ux_prepago_booking_id', { unique: true, where: '"bookingId" IS NOT NULL' })
  @Column({ type: 'varchar', length: 80, nullable: true })
  bookingId?: string;

  /** Código visible de la reserva (para mostrar en la vista de señas). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  bookingCode?: string;

  /** Fecha y hora del turno reservado. */
  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  fechaTurno?: Date;
}
