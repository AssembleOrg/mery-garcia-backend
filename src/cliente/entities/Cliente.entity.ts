// src/modules/cliente/entities/cliente.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    DeleteDateColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Comanda } from '../../comanda/entities/Comanda.entity';
import { PrepagoGuardado } from '../../personal/entities/PrepagoGuardado.entity';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

@Entity({ name: 'clientes' })
export class Cliente {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 20,
        nullable: true,
        unique: true,
        default: null,
    })
    cuit?: string;

    @Column({ length: 100 })
    nombre: string;

    @Column({ default: '' })
    telefono: string;

    @Column({ default: '' })
    email: string;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;

    @OneToMany(() => PrepagoGuardado, pg => pg.cliente, {
        cascade: ['insert', 'update', 'soft-remove', 'recover'],
        eager: false,
    })
    prepagosGuardados: PrepagoGuardado[];

    @OneToMany(() => Comanda, comanda => comanda.cliente)
    comandas: Comanda[];
}
