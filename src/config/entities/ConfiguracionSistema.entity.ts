import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

@Entity({ name: 'configuraciones_sistema' })
export class ConfiguracionSistema {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  clave: string;

  @Column({ type: 'text' })
  valor: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  deletedAt?: Date;
} 