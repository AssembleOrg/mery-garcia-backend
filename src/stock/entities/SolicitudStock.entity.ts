import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { Trabajador } from '../../personal/entities/Trabajador.entity';
import { Personal } from '../../personal/entities/Personal.entity';
import { ProductoStock } from './ProductoStock.entity';

export enum EstadoSolicitudStock {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  /** La canceló el mismo empleado antes de que la resolvieran. */
  CANCELADA = 'CANCELADA',
}

/**
 * Pedido de productos de un empleado para usar en un servicio. No mueve
 * cantidades: es el registro de quién usó qué y quién lo autorizó.
 */
@Entity({ name: 'solicitudes_stock' })
@Index('ix_solicitudes_stock_estado_fecha', ['estado', 'createdAt'])
export class SolicitudStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_solicitudes_stock_trabajador')
  @Column({ type: 'uuid' })
  trabajadorId: string;

  @ManyToOne(() => Trabajador, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trabajadorId' })
  trabajador: Trabajador;

  /** Quién la cargó (el acceso del empleado). */
  @Column({ type: 'uuid' })
  solicitadaPorId: string;

  @Column({
    type: 'enum',
    enum: EstadoSolicitudStock,
    enumName: 'solicitud_stock_estado_enum',
    default: EstadoSolicitudStock.PENDIENTE,
  })
  estado: EstadoSolicitudStock;

  /** Para qué es (servicio, clienta…). Opcional. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  nota: string | null;

  @Column({ type: 'uuid', nullable: true })
  resueltaPorId: string | null;

  @ManyToOne(() => Personal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resueltaPorId' })
  resueltaPor: Personal | null;

  /** Comentario o motivo del rechazo. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  respuesta: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    transformer: TimezoneTransformer,
  })
  resueltaAt: Date | null;

  @OneToMany(() => SolicitudStockItem, (i) => i.solicitud, { cascade: true })
  items: SolicitudStockItem[];

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;
}

@Entity({ name: 'solicitudes_stock_items' })
export class SolicitudStockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_solicitudes_stock_items_solicitud')
  @Column({ type: 'uuid' })
  solicitudId: string;

  @ManyToOne(() => SolicitudStock, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: SolicitudStock;

  /** Si borran el producto, el historial queda con el nombre guardado abajo. */
  @Column({ type: 'uuid', nullable: true })
  productoId: string | null;

  @ManyToOne(() => ProductoStock, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productoId' })
  producto: ProductoStock | null;

  @Column({ length: 150 })
  productoNombre: string;

  @Column({ type: 'smallint', default: 1 })
  cantidad: number;
}
