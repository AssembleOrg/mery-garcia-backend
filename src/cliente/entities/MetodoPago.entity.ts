// src/modules/metodo-pago/entities/metodo-pago.entity.ts
import { TipoPago } from 'src/enums/TipoPago.enum';
import { ItemComanda } from '../../comanda/entities/ItemComanda.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';



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
        transformer: NumericTransformer,
    })
    monto: number;

    @Column({
        name: 'recargo_porcentaje',
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0,
        transformer: NumericTransformer,
    })
    recargoPorcentaje: number;



    @Column({
        name: 'descuento_global_porcentaje',
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0,
        transformer: NumericTransformer,
    })
    descuentoGlobalPorcentaje: number;

    @Column({
        name: 'monto_final',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
        transformer: NumericTransformer,
    })
    montoFinal: number;

    @ManyToOne(() => ItemComanda, itemComanda => itemComanda.metodosPago, {
        onDelete: 'CASCADE',
    })
    itemComanda: ItemComanda;
    

    @Column({ type: 'enum', enum: TipoMoneda })
    moneda: TipoMoneda;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;
}
