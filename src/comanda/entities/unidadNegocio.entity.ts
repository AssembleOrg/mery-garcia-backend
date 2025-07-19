// src/unidades-negocio/unidad-negocio.entity.ts
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProductoServicio } from './productoServicio.entity';

@Entity({ name: 'unidades_negocio' })
export class UnidadNegocio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 100 })
  nombre: string;

  /* ---------- Relaciones ---------- */
  @OneToMany(() => ProductoServicio, (ps) => ps.unidadNegocio)
  productosServicios: ProductoServicio[];

  /* ---------- Fechas ---------- */
  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    transformer: TimezoneTransformer,
    nullable: true,
  })
  deletedAt?: Date;
}
