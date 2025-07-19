import { RolTrabajador } from "src/enums/RolTrabajador.enum";
import { 
  Column, 
  Entity, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn,
  OneToMany,
  ManyToMany
} from "typeorm";
import { TimezoneTransformer } from "../../common/transformers/timezone.transformer";
import { ItemComanda } from "src/comanda/entities/ItemComanda.entity";

@Entity({ name: 'trabajadores' })
export class Trabajador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({
    type: 'enum',
    enum: RolTrabajador,
    enumName: 'rol_trabajador_enum',
    default: RolTrabajador.TRABAJADOR,
  })
  rol: RolTrabajador;

  @Column({
    type: 'numeric', 
    precision: 5, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  comisionPorcentaje: number;

  @Column({ length: 20, nullable: true })
  telefono?: string;

  @OneToMany(() => ItemComanda, item => item.trabajador)
  items: ItemComanda[];

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  deletedAt?: Date;
}