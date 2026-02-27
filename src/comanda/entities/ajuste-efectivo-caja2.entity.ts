import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import { Personal } from 'src/personal/entities/Personal.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';
import { NumericTransformer } from 'src/common/transformers/numeric.transformer';

@Entity({ name: 'ajustes_efectivo_caja2' })
export class AjusteEfectivoCaja2 {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Monto en ARS. Positivo = ingresa efectivo, negativo = sale efectivo. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  montoARS: number;

  /** Monto en USD. Positivo = ingresa efectivo, negativo = sale efectivo. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  montoUSD: number;

  @Column({ type: 'text', nullable: true })
  observaciones?: string;

  @ManyToOne(() => Personal, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  personal: Personal;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  deletedAt: Date;
}
