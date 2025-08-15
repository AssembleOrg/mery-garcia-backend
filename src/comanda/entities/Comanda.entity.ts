// src/comandas/comanda.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
  Index,
  ManyToMany,
  JoinTable,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Personal } from 'src/personal/entities/Personal.entity';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { Descuento } from 'src/comanda/entities/descuento.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';
import { NumericTransformer } from 'src/common/transformers/numeric.transformer';
import { Movimiento } from './movimiento.entity';
import { ItemComanda } from './ItemComanda.entity';
import { Egreso } from './egreso.entity';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';

export enum TipoDeComanda {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export enum EstadoDeComanda {
  PENDIENTE = 'PENDIENTE',
  PAGADA = 'PAGADA',
  CANCELADA = 'CANCELADA',
  FINALIZADA = 'FINALIZADA',
  TRASPASADA = 'TRASPASADA',
  VALIDADO = 'VALIDADO',
}

export enum Caja {
  CAJA_1 = 'caja_1',
  CAJA_2 = 'caja_2',
}

@Entity({ name: 'comandas' })
export class Comanda {
  /* ---------- PK & metadata ---------- */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30 })
  numero: string;

  @Column({
    type: 'enum',
    enum: Caja,
  })
  caja: Caja;

  @CreateDateColumn({
    type: 'timestamptz',
    transformer: TimezoneTransformer,
  })
  createdAt: Date;

  @OneToMany(() => Egreso, (e) => e.comanda, {
    cascade: ['insert', 'update', 'remove'],
    onDelete: 'CASCADE',
  })
  egresos?: Egreso[];

  @UpdateDateColumn({
    type: 'timestamptz',
    transformer: TimezoneTransformer,
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    transformer: TimezoneTransformer,
    nullable: true,
  })
  deletedAt?: Date;

  /** Optimistic locking */
  @VersionColumn()
  version: number;

  /* ---------- Relaciones ---------- */
  @ManyToOne(() => Personal, (p) => p.comandasCreadas, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  creadoPor: Personal;

  @ManyToOne(() => Cliente, (c) => c.comandas, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  cliente?: Cliente;

  @ManyToOne(() => Movimiento, m => m.comandas)
  @JoinColumn({ name: 'movimiento_id' })
  movimiento!: Movimiento;

  @RelationId((comanda: Comanda) => comanda.movimiento)
  movimientoId: string;

  // Relaciones con prepagos específicos (NO CASCADE - no queremos borrar prepagos)
  @ManyToOne(() => PrepagoGuardado, { 
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'prepagoARSID' })
  prepagoARS?: PrepagoGuardado;

  @ManyToOne(() => PrepagoGuardado, { 
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'prepagoUSDID' })
  prepagoUSD?: PrepagoGuardado;

  @OneToMany(() => Descuento, (d) => d.comanda, {
    cascade: ['insert', 'update', 'remove'],
    onDelete: 'CASCADE',
  })
  descuentosAplicados: Descuento[];

  @OneToMany(() => ItemComanda, (ic) => ic.comanda, {
    cascade: ['insert', 'update', 'remove'],
    onDelete: 'CASCADE',
  })
  items: ItemComanda[];
  /* ---------- Data ---------- */
  @Column({
    type: 'enum',
    enum: TipoDeComanda,
  })
  tipoDeComanda: TipoDeComanda;

  @Column({
    type: 'enum',
    enum: EstadoDeComanda,
  })
  estadoDeComanda: EstadoDeComanda;

  @Column({ type: 'boolean', default: false })
  usuarioConsumePrepago: boolean;
  

  @Column({ type: 'boolean', default: false })
  usuarioConsumePrepagoARS: boolean;

  @Column({ type: 'boolean', default: false })
  usuarioConsumePrepagoUSD: boolean;

  @Column({ type: 'uuid', nullable: true })
  prepagoARSID?: string;

  @Column({ type: 'uuid', nullable: true })
  prepagoUSDID?: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  precioDolar: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  precioPesos: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: NumericTransformer,
  })
  valorDolar: number;

  @Column({ type: 'text', nullable: true })
  observaciones?: string;
}
