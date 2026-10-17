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

/** Insumo del control de stock (sin cantidades): solo qué trabajador usa qué producto. */
@Entity({ name: 'productos_stock' })
export class ProductoStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  nombre: string;

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
