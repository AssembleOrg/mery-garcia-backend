// src/descuentos/descuento.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
  } from 'typeorm';
  import { Comanda } from './Comanda.entity';
import { TimezoneTransformer } from 'src/common/transformers/timezone.transformer';
  
  @Entity({ name: 'descuentos' })
  export class Descuento {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ length: 100 })
    nombre: string;
  
    @Column({ type: 'text', nullable: true })
    descripcion?: string;
  
    /** % a aplicar (0 - 100).  Ej: 15,5 ⇒ 15,5 %. */
    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    porcentaje: number;
  
    /** Monto fijo a restar en AR$ - se suma al % si ambos > 0 */
    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    montoFijo: number;
  
    /* ---------- Relaciones ---------- */
    @ManyToOne(() => Comanda, c => c.descuentosAplicados, {
      nullable: false,
      onDelete: 'CASCADE',
    })
    comanda: Comanda;
  
    /* ---------- Fechas ---------- */
    @CreateDateColumn({
      type: 'timestamptz',
      transformer: TimezoneTransformer,
    })
    createdAt: Date;
  
    @UpdateDateColumn({
      type: 'timestamptz',
      transformer: TimezoneTransformer,
    })
    updatedAt: Date;
  
    @DeleteDateColumn({
      type: 'timestamptz',
      transformer: TimezoneTransformer,
      nullable: true,
    })
    deletedAt?: Date;
  }
  