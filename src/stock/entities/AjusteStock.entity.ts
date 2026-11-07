import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductoStock } from './ProductoStock.entity';

/**
 * Corrección a mano de la cantidad de un artículo (conteo, rotura, lo que ya
 * había antes de usar el sistema). `cantidad` es la diferencia: +3 / −2.
 */
@Entity({ name: 'stock_ajustes' })
export class AjusteStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_stock_ajustes_producto')
  @Column({ type: 'uuid' })
  productoId: string;

  @ManyToOne(() => ProductoStock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productoId' })
  producto: ProductoStock;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  hechoPorNombre: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
