import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  VersionColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UnidadNegocio } from './unidadNegocio.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';

export enum TipoProductoServicio {
  PRODUCTO = 'PRODUCTO',
  SERVICIO = 'SERVICIO',
}

@Entity({ name: 'productos_servicios' })
export class ProductoServicio {
  /* ---------- PK ---------- */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ---------- Datos principales ---------- */
  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  precio: number;

  @Column({ type: 'enum', enum: TipoProductoServicio })
  tipo: TipoProductoServicio;

  @ManyToOne(() => UnidadNegocio, (un) => un.productosServicios, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  unidadNegocio: UnidadNegocio;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ default: true })
  activo: boolean;

  /** Duración en minutos (solo para servicios). */
  @Column({ type: 'int', nullable: true })
  duracion?: number;

  @Index({ unique: true, where: "codigoBarras IS NOT NULL" })
  @Column({ length: 50, nullable: true })
  codigoBarras?: string;

  @Column({ default: false })
  esPrecioCongelado: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true })
  precioFijoARS?: number;

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

  /* ---------- Optimistic Lock ---------- */
  @VersionColumn()
  version: number;
}
