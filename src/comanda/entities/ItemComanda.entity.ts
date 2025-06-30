// src/modules/item-comanda/entities/item-comanda.entity.ts
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
import { Comanda } from './Comanda.entity';
import { Personal } from '../../personal/entities/Personal.entity';
import { TipoItem } from './TipoItem.entity';

@Entity({ name: 'item_comanda' })
export class ItemComanda {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'producto_servicio_id' })
    productoServicioId: string;

    @Column({ length: 150 })
    nombre: string;

    @ManyToOne(() => TipoItem, { eager: true })
    @JoinColumn({ name: 'tipo_id' })
    tipo: TipoItem;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    precio: number;

    @Column({ type: 'int', default: 1 })
    cantidad: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    descuento: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    subtotal: number;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @ManyToOne(() => Comanda, comanda => comanda.items, { eager: false })
    @JoinColumn({ name: 'comanda_id' })
    comanda: Comanda;

    @ManyToOne(() => Personal, personal => personal.comandas, { eager: true })
    @JoinColumn({ name: 'personal_id' })
    personal: Personal;
}
