import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Comanda } from "./Comanda.entity";
import { NumericTransformer } from "src/common/transformers/numeric.transformer";


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

  @ManyToOne(() => Comanda, (c) => c.egresos)
  comanda: Comanda;
  
  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0, transformer: NumericTransformer })
  valorDolar: number;

  @Column({ type: 'varchar', length: 3 })
  moneda: string;
}