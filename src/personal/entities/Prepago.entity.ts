// src/modules/prepago/entities/prepago.entity.ts
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { TipoPago } from 'src/enums/TipoPago.enum';



@Entity({ name: 'prepagos' })
export class Prepago {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    monto: number;

    @Column({ type: 'enum', enum: TipoMoneda })
    moneda: TipoMoneda;

    @Column({ type: 'timestamptz', transformer: TimezoneTransformer })
    fecha: Date;

    @Column({ type: 'text', nullable: true })
    observaciones?: string;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;

    @Column({ type: 'enum', enum: TipoPago })
    tipoPago: TipoPago;
}
