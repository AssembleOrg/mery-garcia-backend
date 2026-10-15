import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Trabajador } from '../../personal/entities/Trabajador.entity';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * Porcentaje de comisión confirmado al cierre de un mes. Mientras un mes no
 * tiene fila, se calcula con el mínimo del rango de la trabajadora y se
 * informa también el cálculo al máximo.
 */
@Entity({ name: 'comision_porcentajes_mes' })
@Index(['trabajadorId', 'mes'], { unique: true })
export class ComisionPorcentajeMes {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  trabajadorId: string;

  @ManyToOne(() => Trabajador, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trabajadorId' })
  trabajador: Trabajador;

  /** "YYYY-MM". */
  @Column({ type: 'varchar', length: 7 })
  mes: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: NumericTransformer })
  porcentaje: number;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
