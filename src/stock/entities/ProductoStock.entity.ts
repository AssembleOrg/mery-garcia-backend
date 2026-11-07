import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { Trabajador } from '../../personal/entities/Trabajador.entity';

/**
 * Insumo del control de stock y qué trabajador lo usa. La cantidad no se
 * guarda: sale de lo entregado en compras − lo usado (pedidos del personal
 * aprobados) + ajustes (ver cantidades-stock.ts).
 */
@Entity({ name: 'productos_stock' })
export class ProductoStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

  /** Aviso cuando quedan esta cantidad o menos. Null = sólo avisa con 1 o 0. */
  @Column({ type: 'int', nullable: true })
  stockMinimo: number | null;

  @ManyToMany(() => Trabajador, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'productos_stock_trabajadores',
    joinColumn: { name: 'productoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'trabajadorId', referencedColumnName: 'id' },
  })
  trabajadores: Trabajador[];

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
