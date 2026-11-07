import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * Etiqueta para agrupar lo que se compra (Estilismo, Descartables…). Un
 * renglón puede tener varias. Borrarla la saca de los renglones que la tenían.
 */
@Entity({ name: 'compras_categorias' })
export class CategoriaCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ux_compras_categorias_nombre', { unique: true })
  @Column({ length: 60 })
  nombre: string;

  /** Orden en que se muestran. */
  @Column({ type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
