import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Comanda } from './Comanda.entity';

@Entity({ name: 'tipos_comanda' })
export class TipoComanda {
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

  @OneToMany(() => Comanda, comanda => comanda.tipo)
  comandas: Comanda[];
} 