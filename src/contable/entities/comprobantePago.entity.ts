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
import { Adelanto } from './adelanto.entity';

/**
 * Comprobante adjunto a un pago o a un adelanto (foto, PDF). Los bytes van a Postgres, como
 * los adjuntos de WhatsApp, para que queden privados; `datos` no se selecciona
 * salvo al descargar.
 */
@Entity({ name: 'contable_comprobantes' })
export class ComprobantePago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** De un pago o de un adelanto (uno de los dos). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  pagoId: string | null;

  @ManyToOne(() => PagoDeuda, (p) => p.comprobantes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'pagoId' })
  pago: PagoDeuda | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  adelantoId: string | null;

  @ManyToOne(() => Adelanto, (a) => a.comprobantes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'adelantoId' })
  adelanto: Adelanto | null;

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
