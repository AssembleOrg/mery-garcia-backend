import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { AutorMensaje, DireccionMensaje, EstadoEnvio, TipoMensaje } from '../whatsapp.enums';
import { Personal } from '../../personal/entities/Personal.entity';

@Entity({ name: 'whatsapp_mensaje' })
@Index('ix_whatsapp_msg_conv_created', ['conversacionId', 'createdAt'])
export class WhatsappMensaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversacionId: string;

  @Column({ type: 'enum', enum: DireccionMensaje, enumName: 'whatsapp_direccion_enum' })
  direccion: DireccionMensaje;

  @Column({ type: 'enum', enum: AutorMensaje, enumName: 'whatsapp_autor_enum' })
  autor: AutorMensaje;

  @Column({ type: 'uuid', nullable: true })
  operadorId: string | null;

  @ManyToOne(() => Personal, { eager: true, nullable: true })
  @JoinColumn({ name: 'operadorId' })
  operador: Personal | null;

  @Column({ type: 'enum', enum: TipoMensaje, enumName: 'whatsapp_tipo_mensaje_enum', default: TipoMensaje.TEXTO })
  tipo: TipoMensaje;

  /** Texto, o el caption de un adjunto. */
  @Column({ type: 'text', nullable: true })
  texto: string | null;

  /** Adjunto (audio/imagen/documento): los bytes viven en whatsapp_adjunto. */
  @Column({ type: 'uuid', nullable: true })
  adjuntoId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mimeType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreArchivo: string | null;

  @Column({ type: 'integer', nullable: true })
  tamanoBytes: number | null;

  @Column({ type: 'integer', nullable: true })
  duracionSegundos: number | null;

  /** Clave de la respuesta de la tabla que mandó el bot. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  respuestaClave: string | null;

  /** Id de WhatsApp: entrantes para marcar leído, salientes como constancia. */
  @Index('ix_whatsapp_msg_wa_id')
  @Column({ type: 'varchar', length: 128, nullable: true })
  waMessageId: string | null;

  @Column({ type: 'enum', enum: EstadoEnvio, enumName: 'whatsapp_estado_envio_enum', nullable: true })
  estadoEnvio: EstadoEnvio | null;

  /** Ya se avisó a WhatsApp que una persona lo leyó (tilde azul). */
  @Column({ type: 'boolean', default: false })
  leidoAvisado: boolean;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;
}
