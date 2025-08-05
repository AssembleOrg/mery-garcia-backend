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
import { TipoItem } from './TipoItem.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { ProductoServicio } from './productoServicio.entity';

@Entity({ name: 'item_comanda' })
export class ItemComanda {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => ProductoServicio, { eager: true })
    @JoinColumn({ name: 'producto_servicio_id' })
    productoServicio: ProductoServicio;

    @Column({ length: 150 })
    nombre: string;

    @ManyToOne(() => TipoItem, { eager: true })
    @JoinColumn({ name: 'tipo_id' })
    tipo: TipoItem;

    @Column({ type: 'numeric', precision: 20, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    precio: number;

    @Column({ type: 'int', default: 1 })
    cantidad: number;

    @Column({ type: 'numeric', precision: 20, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    descuento: number;

    @Column({ type: 'numeric', precision: 20, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    subtotal: number;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;

    @ManyToOne(() => Comanda, comanda => comanda.items, { eager: false })
    @JoinColumn({ name: 'comanda_id' })
    comanda: Comanda;

    @ManyToOne(() => Trabajador, trabajador => trabajador.items, { eager: true })
    @JoinColumn({ name: 'trabajador_id' })
    trabajador: Trabajador;     

    // @RelationId((item: ItemComanda) => item.trabajador)
    // trabajadorId: string;

    // @RelationId((item: ItemComanda) => item.productoServicio)
    // productoServicioId: string;
}
