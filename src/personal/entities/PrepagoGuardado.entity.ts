// src/modules/prepago-guardado/entities/prepago-guardado.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Cliente } from '../../cliente/entities/Cliente.entity';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';



@Entity({ name: 'prepagos_guardados' })
export class PrepagoGuardado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monto: number;

  @Column({ type: 'enum', enum: TipoMoneda })
  moneda: TipoMoneda;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaCreacion: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fechaVencimiento?: Date;

  @Column({ type: 'enum', enum: EstadoPrepago })
  estado: EstadoPrepago;

  @Column({ default: '' })
  observaciones: string;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => Cliente, cliente => cliente.prepagosGuardados, {
    eager: false,
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;
}
