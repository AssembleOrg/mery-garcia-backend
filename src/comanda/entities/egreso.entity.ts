import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { Comanda } from "./Comanda.entity";
import { NumericTransformer } from "src/common/transformers/numeric.transformer";
import { Caja } from "src/enums/Caja.enum";
import { TimezoneTransformer } from "src/common/transformers/timezone.transformer";


@Entity()
export class Egreso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0, transformer: NumericTransformer })
  total: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0, transformer: NumericTransformer })
  totalDolar: number;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0, transformer: NumericTransformer })
  totalPesos: number;   

  @ManyToOne(() => Comanda, (c) => c.egresos, {
    onDelete: 'CASCADE',
  })
  comanda: Comanda;
  
  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0, transformer: NumericTransformer })
  valorDolar: number;

  @Column({ type: 'varchar', length: 3 })
  moneda: string;

  @Column({ type: 'enum', enum: Caja, default: Caja.CAJA_1 })
  caja: Caja;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  deletedAt: Date;
}