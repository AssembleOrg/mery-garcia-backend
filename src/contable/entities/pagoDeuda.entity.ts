import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { Deuda } from './deuda.entity';
import { ComprobantePago } from './comprobantePago.entity';

/**
 * Pago (total o parcial) que descuenta el saldo de una deuda. Va en la moneda
 * de la deuda. Se puede editar o borrar sólo en las primeras 24 h; el borrado
 * es lógico para que el historial lo siga mostrando.
 */
@Entity({ name: 'contable_pagos' })
export class PagoDeuda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  deudaId: string;

  @ManyToOne(() => Deuda, (d) => d.pagos)
  @JoinColumn({ name: 'deudaId' })
  deuda: Deuda;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: NumericTransformer,
  })
  monto: number;

  /** Día del pago (YYYY-MM-DD). */
  @Column({ type: 'date' })
  fecha: string;

  /** Efectivo, transferencia, cheque... texto libre. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  metodo: string | null;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'uuid', nullable: true })
  creadoPorId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  creadoPorNombre: string | null;

  @OneToMany(() => ComprobantePago, (c) => c.pago)
  comprobantes: ComprobantePago[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
