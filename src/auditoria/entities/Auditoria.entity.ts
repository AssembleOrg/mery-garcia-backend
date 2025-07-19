import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Personal } from 'src/personal/entities/Personal.entity';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';





@Entity({ name: 'auditoria' })
export class Auditoria {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: TipoAccion,
        enumName: 'tipo_accion_enum',
    })
    tipoAccion: TipoAccion;

    @Column({
        type: 'enum',
        enum: ModuloSistema,
        enumName: 'modulo_sistema_enum',
    })
    modulo: ModuloSistema;

    @Column({ length: 255 })
    descripcion: string;

    @Column({ type: 'jsonb', nullable: true })
    datosAnteriores?: any;

    @Column({ type: 'jsonb', nullable: true })
    datosNuevos?: any;

    @Column({ length: 500, nullable: true })
    observaciones?: string;

    @Column({ length: 45, nullable: true })
    ipAddress?: string;

    @Column({ length: 255, nullable: true })
    userAgent?: string;

    @ManyToOne(() => Personal, { nullable: true })
    @JoinColumn({ name: 'usuario_id' })
    usuario: Personal;

    @Column({ type: 'uuid', nullable: true })
    entidadId?: string;

    @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
    createdAt: Date;
} 