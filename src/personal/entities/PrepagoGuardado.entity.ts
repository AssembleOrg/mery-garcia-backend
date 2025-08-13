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
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { TipoPago } from 'src/enums/TipoPago.enum';



@Entity({ name: 'prepagos_guardados' })
export class PrepagoGuardado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  monto: number;

  @Column({ type: 'enum', enum: TipoMoneda })
  moneda: TipoMoneda;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  fechaCreacion: Date;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  fechaVencimiento?: Date;

  @Column({ type: 'enum', enum: EstadoPrepago })
  estado: EstadoPrepago;

  @Column({ default: '' })
  observaciones: string;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  deletedAt?: Date;

  @ManyToOne(() => Cliente, cliente => cliente.prepagosGuardados, {
    eager: false,
  })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;


  @Column({ type: 'enum', enum: TipoPago })
  tipoPago: TipoPago;
}
