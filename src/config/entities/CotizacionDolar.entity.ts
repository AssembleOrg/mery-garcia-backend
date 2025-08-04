import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

@Entity('cotizaciones_dolar')
export class CotizacionDolar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  compra: number;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  venta: number;

  @Column({ type: 'varchar', length: 100 })
  casa: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  moneda: string;

  @Column({ type: 'timestamp', transformer: TimezoneTransformer })
  fechaActualizacion: Date;

  @Column({ type: 'varchar', length: 50, default: 'API' })
  fuente: string; // 'API' | 'MANUAL'

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @CreateDateColumn({ transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ transformer: TimezoneTransformer })
  updatedAt: Date;
} 