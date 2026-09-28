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
import { TipoMoneda } from '../../enums/TipoMoneda.enum';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { Acreedor } from './acreedor.entity';
import { PagoDeuda } from './pagoDeuda.entity';

/** Algo que el negocio le debe a un acreedor. El saldo = monto - pagos. */
@Entity({ name: 'contable_deudas' })
export class Deuda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  acreedorId: string;

  @ManyToOne(() => Acreedor, (a) => a.deudas)
  @JoinColumn({ name: 'acreedorId' })
  acreedor: Acreedor;

  @Column({ length: 200 })
  concepto: string;

  @Column({ type: 'varchar', length: 3 })
  moneda: TipoMoneda;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: NumericTransformer,
  })
  monto: number;

  /** Día en que se generó la deuda (YYYY-MM-DD). */
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'date', nullable: true })
  vencimiento: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ type: 'uuid', nullable: true })
  creadoPorId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  creadoPorNombre: string | null;

  @OneToMany(() => PagoDeuda, (p) => p.deuda)
  pagos: PagoDeuda[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
