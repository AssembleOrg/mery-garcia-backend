// src/modules/comanda/entities/comanda.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    ManyToMany,
    OneToOne,
    JoinColumn,
    JoinTable,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    VersionColumn,
} from 'typeorm';
import { ItemComanda } from './ItemComanda.entity';
import { Cliente } from '../../cliente/entities/Cliente.entity';
import { Prepago } from '../../personal/entities/Prepago.entity';
import { MetodoPago } from '../../cliente/entities/MetodoPago.entity';
import { Comision } from '../../personal/entities/Comision.entity';
import { Personal } from '../../personal/entities/Personal.entity';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { Caja } from 'src/enums/Caja.enum';
import { TipoComanda } from './TipoComanda.entity';

export enum EstadoComanda {
    PENDIENTE = 'pendiente',
    EN_PROCESO = 'en_proceso',
    COMPLETADO = 'completado',
    CANCELADO = 'cancelado',
}

@Entity({ name: 'comandas' })
export class Comanda {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 50, unique: true })
    numero: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    /** Soft-delete marker */
    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @Column({ type: 'timestamptz' })
    fecha: Date;

    @Column({ type: 'enum', enum: UnidadNegocio })
    unidadNegocio: UnidadNegocio;

    @Column({
        type: 'enum',
        enum: Caja,
        enumName: 'caja_enum',
        default: Caja.CAJA_1,
    })
    enCaja: Caja;

    @ManyToOne(() => Cliente, cliente => cliente.comandas, { eager: true })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @ManyToOne(() => Personal, personal => personal.comandas, { eager: true })
    @JoinColumn({ name: 'personal_principal_id' })
    personalPrincipal: Personal;

    @OneToMany(() => ItemComanda, item => item.comanda, {
        cascade: ['insert', 'update', 'soft-remove', 'recover'],
        eager: false,
    })
    items: ItemComanda[];

    @OneToOne(() => Prepago, prepago => prepago.comanda, {
        cascade: ['insert', 'update', 'soft-remove', 'recover'],
        eager: true,
        nullable: true,
    })
    @JoinColumn({ name: 'prepago_id' })
    prepago?: Prepago;

    @ManyToMany(() => MetodoPago, { eager: false })
    @JoinTable({ name: 'comanda_metodos_pago' })
    metodosPago: MetodoPago[];

    // ▼ Campos numéricos con transformer para mapear string→number
    @Column({
        type: 'numeric', precision: 12, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    subtotal: number;

    @Column({
        type: 'numeric', precision: 12, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    totalDescuentos: number;

    @Column({
        type: 'numeric', precision: 12, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    totalRecargos: number;

    @Column({
        name: 'total_prepago',
        type: 'numeric', precision: 12, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    totalPrepago: number;

    @Column({
        type: 'numeric', precision: 12, scale: 2, default: 0,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    totalFinal: number;

    @OneToMany(() => Comision, comision => comision.comanda, {
        cascade: ['insert', 'update', 'soft-remove', 'recover'],
        eager: false,
    })
    comisiones: Comision[];

    @Column({ type: 'enum', enum: EstadoComanda, default: EstadoComanda.PENDIENTE })
    estado: EstadoComanda;

    @ManyToOne(() => TipoComanda, { eager: true })
    @JoinColumn({ name: 'tipo_id' })
    tipo: TipoComanda;

    @Column({ length: 500, nullable: true })
    observaciones?: string;

    /** Para optimistic locking */
    @VersionColumn()
    version: number;
}
