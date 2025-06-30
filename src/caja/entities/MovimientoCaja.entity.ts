import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Caja } from 'src/enums/Caja.enum';
import { TipoMovimiento } from 'src/enums/TipoMovimiento.enum';
import { Personal } from 'src/personal/entities/Personal.entity';

@Entity({ name: 'movimientos_caja' })
export class MovimientoCaja {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: Caja,
        enumName: 'caja_enum',
    })
    caja: Caja;

    @Column({
        type: 'enum',
        enum: TipoMovimiento,
        enumName: 'tipo_movimiento_enum',
    })
    tipoMovimiento: TipoMovimiento;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    monto: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    saldoAnterior: number;

    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        transformer: {
            to: (v: number) => v,
            from: (v: string) => parseFloat(v),
        },
    })
    saldoPosterior: number;

    @Column({ length: 500 })
    observaciones: string;

    @Column({ length: 100, nullable: true })
    referencia?: string; // Para referenciar comandas, transferencias, etc.

    @ManyToOne(() => Personal)
    @JoinColumn({ name: 'usuario_id' })
    usuario: Personal;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
} 