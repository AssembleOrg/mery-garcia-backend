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
import { ComprobantePago } from './comprobantePago.entity';

/**
 * Plata que se le da a un acreedor antes de que exista la deuda (p. ej.
 * adelantos de comisiones que recién se calculan a fin de mes). Queda como
 * saldo a favor y, cuando se carga la deuda real, se aplica: cada aplicación
 * es un PagoDeuda con `adelantoId`, así que no mueve caja dos veces.
 *
 * Disponible = monto - aplicaciones vivas.
 */
@Entity({ name: 'contable_adelantos' })
export class Adelanto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  acreedorId: string;

  @ManyToOne(() => Acreedor)
  @JoinColumn({ name: 'acreedorId' })
  acreedor: Acreedor;

  /** A cuenta de qué: "Comisiones octubre". */
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

  /** Día en que se entregó (YYYY-MM-DD). */
  @Column({ type: 'date' })
  fecha: string;

  /** Cuándo se espera liquidar (orientativo: no vence ni bloquea nada). */
  @Column({ type: 'date', nullable: true })
  fechaEstimada: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  metodo: string | null;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'uuid', nullable: true })
  creadoPorId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  creadoPorNombre: string | null;

  @OneToMany(() => PagoDeuda, (p) => p.adelanto)
  aplicaciones: PagoDeuda[];

  @OneToMany(() => ComprobantePago, (c) => c.adelanto)
  comprobantes: ComprobantePago[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
