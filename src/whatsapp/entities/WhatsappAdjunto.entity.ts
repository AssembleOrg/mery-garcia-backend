import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Bytes de un adjunto (audio, imagen, documento). Tabla aparte para que
 * listar mensajes no arrastre megabytes; se lee sólo al reproducir/descargar.
 *
 * Van a Postgres y no a un bucket a propósito: quedan privados sin configurar
 * nada y el volumen de un salón (unos audios por día, tope 16 MB) lo aguanta.
 */
@Entity({ name: 'whatsapp_adjunto' })
export class WhatsappAdjunto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ type: 'bytea' })
  datos: Buffer;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
