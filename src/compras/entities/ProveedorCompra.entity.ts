import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * A quién se le compra (insumos, descartables, café…). Borrarlo lo esconde de
 * las listas pero los pedidos viejos lo siguen mostrando.
 */
@Entity({ name: 'compras_proveedores' })
export class ProveedorCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_compras_proveedores_nombre')
  @Column({ length: 120 })
  nombre: string;

  /** CUIT, DNI o lo que sirva para identificarlo. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  documento: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  /** Alias/CBU, horarios, a quién hablarle… */
  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
    transformer: TimezoneTransformer,
  })
  deletedAt: Date | null;
}
