// src/modules/personal/entities/personal.entity.ts
import { Comanda } from 'src/comanda/entities/Comanda.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { RolPersonal } from 'src/enums/RolPersonal.enum';

@Entity({ name: 'personal' })
export class Personal {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    nombre: string;

    @Column({ length: 100, unique: true })
    email: string;

    @Column({ length: 255 })
    password: string;

    @Column('numeric', { precision: 5, scale: 2, default: 0 })
    comisionPorcentaje: number;

    @Column({ default: true })
    activo: boolean;

    @Column({
        type: 'enum',
        enum: RolPersonal,
        enumName: 'rol_personal_enum',
        default: RolPersonal.USER,
    })
    rol: RolPersonal;

    @Column({
        type: 'enum',
        enum: UnidadNegocio,
        enumName: 'unidad_negocio_enum',
        array: true,
        default: () => 'ARRAY[\'tattoo\']::unidad_negocio_enum[]',
    })
    unidadesDisponibles: UnidadNegocio[];

    @Column({ nullable: true })
    telefono?: string;

    @Column({ type: 'timestamptz' })
    fechaIngreso: Date;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true })
    deletedAt?: Date;

    @OneToMany(() => Comanda, c => c.personalPrincipal)
    comandas: Comanda[];
}
