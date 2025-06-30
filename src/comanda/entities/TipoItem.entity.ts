import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ItemComanda } from './ItemComanda.entity';

@Entity({ name: 'tipos_item' })
export class TipoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ default: true })
  activo: boolean;

  @Column({ default: 0 })
  orden: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => ItemComanda, item => item.tipo)
  items: ItemComanda[];
} 