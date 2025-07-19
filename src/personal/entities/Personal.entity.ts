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
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { Movimiento } from 'src/comanda/entities/movimiento.entity';

@Entity({ name: 'personal' })
export class Personal {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @OneToMany(() => Movimiento, (m) => m.personal, {
        cascade: true,
    })
    movimientos: Movimiento[];

    @Column({ length: 100 })
    nombre: string;

    @Column({ length: 100, unique: true })
    email: string;

    @Column({ length: 255 })
    password: string;

    @Column({ default: true })
    activo: boolean;

    @Column({
        type: 'enum',
        enum: RolPersonal,
        enumName: 'rol_personal_enum',
        default: RolPersonal.USER,
    })
    rol: RolPersonal;

    @OneToMany(() => Comanda, comanda => comanda.creadoPor)
    comandasCreadas: Comanda[];

    @Column({ type: 'timestamptz', transformer: TimezoneTransformer })
    fechaIngreso: Date;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
    deletedAt?: Date;
}
