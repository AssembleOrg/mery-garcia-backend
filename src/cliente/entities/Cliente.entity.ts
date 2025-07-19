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
import { TipoMoneda } from '../../enums/TipoMoneda.enum';
import { EstadoPrepago } from '../../enums/EstadoPrepago.enum';

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
    fechaRegistro: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;

    @OneToMany(() => PrepagoGuardado, pg => pg.cliente, {
        cascade: ['insert', 'update', 'soft-remove', 'recover'],
        eager: false,
    })
    prepagosGuardados: PrepagoGuardado[];

    @Column({ type: 'text', nullable: true })
    comentarios?: string;

    @OneToMany(() => Comanda, comanda => comanda.cliente)
    comandas: Comanda[];

    // Computed property for señasDisponibles
    get señasDisponibles(): { ars: number; usd: number } {
        if (!this.prepagosGuardados) {
            return { ars: 0, usd: 0 };
        }

        const ars = this.prepagosGuardados
            .filter(pg => pg.moneda === TipoMoneda.ARS && pg.estado === EstadoPrepago.ACTIVA)
            .reduce((sum, pg) => sum + Number(pg.monto), 0);

        const usd = this.prepagosGuardados
            .filter(pg => pg.moneda === TipoMoneda.USD && pg.estado === EstadoPrepago.ACTIVA)
            .reduce((sum, pg) => sum + Number(pg.monto), 0);

        return { ars, usd };
    }
}
