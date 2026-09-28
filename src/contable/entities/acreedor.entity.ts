import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Deuda } from './deuda.entity';

export enum TipoAcreedor {
  PERSONA = 'PERSONA',
  EMPRESA = 'EMPRESA',
}

/**
 * A quién le debe el negocio: una persona o una empresa. Sólo agrupa deudas;
 * los saldos salen de sumar deudas y pagos.
 */
@Entity({ name: 'contable_acreedores' })
export class Acreedor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 10, default: TipoAcreedor.PERSONA })
  tipo: TipoAcreedor;

  /** CUIT, DNI o lo que sirva para identificarlo. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  documento: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @OneToMany(() => Deuda, (d) => d.acreedor)
  deudas: Deuda[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
