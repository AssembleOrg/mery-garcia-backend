import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Comanda } from './Comanda.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';

@Entity({ name: 'movimientos' })
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  montoARS: number;

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  montoUSD: number;

  @OneToMany(() => Comanda, (c) => c.movimiento, {
    cascade: true,
  })
  comandas?: Comanda[];

  @RelationId((m: Movimiento) => m.comandas)
  comandasValidadasIds!: string[];

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  efectivoARS: number;

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  efectivoUSD: number;

  @ManyToOne(() => Personal, (p) => p.movimientos, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  personal: Personal;

  @Column({ type: 'text', nullable: true })
  comentario?: string;

  @Column({ type: 'boolean', nullable: true })
  esIngreso?: boolean;

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  residualARS: number;

  @Column({ type: 'numeric', precision: 30, scale: 2, default: 0 })
  residualUSD: number;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  deletedAt: Date;
}