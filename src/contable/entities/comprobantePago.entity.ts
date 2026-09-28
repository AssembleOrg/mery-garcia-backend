import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PagoDeuda } from './pagoDeuda.entity';

/**
 * Comprobante adjunto a un pago (foto, PDF). Los bytes van a Postgres, como
 * los adjuntos de WhatsApp, para que queden privados; `datos` no se selecciona
 * salvo al descargar.
 */
@Entity({ name: 'contable_comprobantes' })
export class ComprobantePago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  pagoId: string;

  @ManyToOne(() => PagoDeuda, (p) => p.comprobantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pagoId' })
  pago: PagoDeuda;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'int' })
  tamanio: number;

  @Column({ type: 'bytea', select: false })
  datos: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
