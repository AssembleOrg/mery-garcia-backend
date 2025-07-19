import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from 'typeorm';
import { Comanda } from './Comanda.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';

@Entity({ name: 'movimientos' })
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  montoARS: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  montoUSD: number;

  @ManyToOne(() => Comanda, (c) => c.movimiento, {
    cascade: true,
  })
  comandas?: Comanda[];

  @RelationId((m: Movimiento) => m.comandas)
  comandasValidadasIds!: string[];

  @ManyToOne(() => Personal, (p) => p.movimientos, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  personal: Personal;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  residualARS: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  residualUSD: number;

  @CreateDateColumn({ type: 'timestamp', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', transformer: TimezoneTransformer })
  deletedAt: Date;
}