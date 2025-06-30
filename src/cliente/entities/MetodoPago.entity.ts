// src/modules/metodo-pago/entities/metodo-pago.entity.ts
import { TipoPago } from 'src/enums/TipoPago.enum';
import { Comanda } from '../../comanda/entities/Comanda.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';



@Entity({ name: 'metodos_pago' })
export class MetodoPago {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: TipoPago })
    tipo: TipoPago;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    monto: number;

    @Column({
        name: 'recargo_porcentaje',
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    recargoPorcentaje: number;

    @Column({
        name: 'monto_final',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    montoFinal: number;

    @ManyToOne(() => Comanda, comanda => comanda.metodosPago, {
        onDelete: 'CASCADE',
    })
    comanda: Comanda;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
