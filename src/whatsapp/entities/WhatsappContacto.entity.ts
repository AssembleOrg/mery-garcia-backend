import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';

/**
 * Quién escribe. Una fila por número de WhatsApp.
 *
 * `chatJid` es la dirección técnica del chat (puede ser un LID, un id opaco
 * que parece un número y no lo es). Sirve para responder y para nada más:
 * ninguna respuesta de la API lo incluye. Lo que la gente ve es `telefono`.
 */
@Entity({ name: 'whatsapp_contacto' })
export class WhatsappContacto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ux_whatsapp_contacto_chat_jid', { unique: true })
  @Column({ type: 'varchar', length: 80 })
  chatJid: string;

  /** Dígitos E.164 (5491136585581) o null si no se pudo resolver. */
  @Index('ix_whatsapp_contacto_telefono')
  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  /** Nombre que la clienta tiene en su WhatsApp. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  nombreWhatsapp: string | null;

  /** Clienta del ERP con el mismo teléfono, si se encontró. */
  @Column({ type: 'uuid', nullable: true })
  clienteId: string | null;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
