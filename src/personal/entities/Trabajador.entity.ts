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
import { NumericTransformer } from "../../common/transformers/numeric.transformer";
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

  /**
   * Tope del rango de comisión (ej. 35 para "entre 30 y 35%"). El mínimo es
   * comisionPorcentaje; el valor del mes se confirma al cierre
   * (ComisionPorcentajeMes). Null = sin rango.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: NumericTransformer })
  comisionPorcentajeMax: number | null;

  /** Porcentaje sobre productos (precio en efectivo) en el esquema por base fija. */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: NumericTransformer })
  comisionProductosPorcentaje: number | null;

  /**
   * Desde qué día (YYYY-MM-DD) rige el esquema por base fija (ComisionBase).
   * Null, o comandas anteriores: cálculo histórico (30% servicios, 10% productos).
   */
  @Column({ type: 'date', nullable: true })
  comisionBaseDesde: string | null;

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