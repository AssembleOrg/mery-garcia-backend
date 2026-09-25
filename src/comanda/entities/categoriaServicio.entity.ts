import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProductoServicio } from './productoServicio.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';

/**
 * Categoría de servicio (A, B, C...). Agrupa servicios para poder contar en
 * caja/comisiones cuántos de cada categoría hizo cada profesional.
 * Ej.: A = laminado, modelado, refill; B = tintes, refill de lashes.
 *
 * Se edita desde Configuración. Borrar una categoría deja sus servicios sin
 * categoría (no los borra).
 */
@Entity({ name: 'categorias_servicio' })
export class CategoriaServicio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 60 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string | null;

  /** Orden en que se muestra (A, B, C...). */
  @Column({ type: 'int', default: 0 })
  orden: number;

  @OneToMany(() => ProductoServicio, (ps) => ps.categoria)
  servicios: ProductoServicio[];

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
