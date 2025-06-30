import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Caja as CajaEnum } from 'src/enums/Caja.enum';

@Entity({ name: 'cajas' })
export class Caja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: CajaEnum,
    enumName: 'caja_enum',
    unique: true,
  })
  nombre: CajaEnum;

  @Column({ length: 100, nullable: true })
  descripcion?: string;

  @Column({ default: true })
  activa: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
} 