// src/modules/comision/entities/comision.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';
import { ItemComanda } from '../../comanda/entities/ItemComanda.entity';
import { Comanda } from '../../comanda/entities/Comanda.entity';

@Entity({ name: 'comisiones' })
export class Comision {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'personal_id', length: 36 })
    personalId: string;

    @Column({ name: 'personal_nombre', length: 100 })
    personalNombre: string;

    @Column({ name: 'item_comanda_id', length: 36 })
    itemComandaId: string;

    @Column({
        name: 'monto_base',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    montoBase: number;

    @Column({
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    porcentaje: number;

    @Column({
        name: 'monto_comision',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    montoComision: number;

    @ManyToOne(() => Comanda, comanda => comanda.comisiones, {
        onDelete: 'CASCADE',
    })
    comanda: Comanda;

    @ManyToOne(() => ItemComanda, { nullable: true })
    itemComanda?: ItemComanda;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt?: Date;
}
