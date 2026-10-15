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
import { CategoriaServicio } from './categoriaServicio.entity';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * Monto base (ARS) sobre el que se calcula la comisión de una trabajadora por
 * cada servicio de una categoría. Ej.: Luna, Categoría A → $45.000; Rosario,
 * Categoría A → $40.000. Si la trabajadora tiene bases cargadas, sus servicios
 * de categorías sin base no comisionan (ver comisiones/reglas.ts).
 */
@Entity({ name: 'comision_bases' })
@Index(['trabajadorId', 'categoriaId'], { unique: true })
export class ComisionBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  trabajadorId: string;

  @ManyToOne(() => Trabajador, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trabajadorId' })
  trabajador: Trabajador;

  @Column({ type: 'uuid' })
  categoriaId: string;

  @ManyToOne(() => CategoriaServicio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoriaId' })
  categoria: CategoriaServicio;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: NumericTransformer })
  montoBase: number;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
