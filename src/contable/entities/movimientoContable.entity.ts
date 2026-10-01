import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';

export enum TipoMovimientoContable {
  ACREEDOR_CREADO = 'ACREEDOR_CREADO',
  ACREEDOR_EDITADO = 'ACREEDOR_EDITADO',
  ACREEDOR_ELIMINADO = 'ACREEDOR_ELIMINADO',
  DEUDA_CREADA = 'DEUDA_CREADA',
  DEUDA_EDITADA = 'DEUDA_EDITADA',
  DEUDA_ELIMINADA = 'DEUDA_ELIMINADA',
  PAGO_REGISTRADO = 'PAGO_REGISTRADO',
  PAGO_EDITADO = 'PAGO_EDITADO',
  PAGO_ELIMINADO = 'PAGO_ELIMINADO',
  COMPROBANTE_AGREGADO = 'COMPROBANTE_AGREGADO',
  COMPROBANTE_ELIMINADO = 'COMPROBANTE_ELIMINADO',
  ADELANTO_REGISTRADO = 'ADELANTO_REGISTRADO',
  ADELANTO_EDITADO = 'ADELANTO_EDITADO',
  ADELANTO_ELIMINADO = 'ADELANTO_ELIMINADO',
  ADELANTO_APLICADO = 'ADELANTO_APLICADO',
}

/**
 * Historial de todo lo que pasa en contable. Sólo se inserta: aunque se borre
 * un pago o una deuda, acá queda quién, cuándo y cómo estaba.
 */
@Entity({ name: 'contable_historial' })
export class MovimientoContable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoMovimientoContable;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  acreedorId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  deudaId: string | null;

  @Column({ type: 'uuid', nullable: true })
  pagoId: string | null;

  @Column({ type: 'uuid', nullable: true })
  adelantoId: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  moneda: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: NumericTransformer,
  })
  monto: number | null;

  @Column({ type: 'text' })
  descripcion: string;

  /** Estado anterior / nuevo en ediciones y borrados. */
  @Column({ type: 'jsonb', nullable: true })
  detalle: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  usuarioNombre: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
