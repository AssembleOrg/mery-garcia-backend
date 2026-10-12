import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimezoneTransformer } from '../../common/transformers/timezone.transformer';
import { EstadoConversacion, MotivoCierre, MotivoEspera } from '../whatsapp.enums';
import { WhatsappContacto } from './WhatsappContacto.entity';
import { Personal } from '../../personal/entities/Personal.entity';

@Entity({ name: 'whatsapp_conversacion' })
@Index('ix_whatsapp_conv_estado_ultimo', ['estado', 'ultimoMensajeAt'])
export class WhatsappConversacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('ix_whatsapp_conv_contacto')
  @Column({ type: 'uuid' })
  contactoId: string;

  @ManyToOne(() => WhatsappContacto, { eager: true })
  @JoinColumn({ name: 'contactoId' })
  contacto: WhatsappContacto;

  @Column({ type: 'enum', enum: EstadoConversacion, enumName: 'whatsapp_estado_conversacion_enum', default: EstadoConversacion.BOT })
  estado: EstadoConversacion;

  @Column({ type: 'enum', enum: MotivoEspera, enumName: 'whatsapp_motivo_espera_enum', nullable: true })
  motivoEspera: MotivoEspera | null;

  /** Quién la tomó desde la web. */
  @Column({ type: 'uuid', nullable: true })
  atendidaPorId: string | null;

  @ManyToOne(() => Personal, { eager: true, nullable: true })
  @JoinColumn({ name: 'atendidaPorId' })
  atendidaPor: Personal | null;

  /** Cuántas veces seguidas el bot no entendió. Dos → pasa a una persona. */
  @Column({ type: 'smallint', default: 0 })
  noEntendidosSeguidos: number;

  /** El bot mostró el menú de "no entendí" y espera 1/2/3. */
  @Column({ type: 'boolean', default: false })
  esperandoOpcionMenu: boolean;

  @Column({ type: 'integer', default: 0 })
  noLeidos: number;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  ultimoMensajeAt: Date | null;

  /** Último mensaje de la clienta (para "responder dentro de las 24h" y el orden). */
  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  ultimoEntranteAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  esperandoDesde: Date | null;

  /**
   * Marca de "espera vencida": la charla estuvo esperando a una persona más
   * del tiempo límite, nadie la tomó y volvió sola al bot. Queda hasta que
   * alguien del equipo la revisa (la toma, le escribe o la marca revisada).
   * No depende del estado: una charla vencida puede estar con el bot o cerrada.
   */
  @Index('ix_whatsapp_conv_vencida')
  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  vencidaAt: Date | null;

  /** Por qué estaba esperando cuando venció (un MotivoEspera). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  vencidaMotivo: string | null;

  /** Desde cuándo esperaba cuando venció. */
  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  vencidaEsperandoDesde: Date | null;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  avisoInactividadAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, transformer: TimezoneTransformer })
  cerradaAt: Date | null;

  @Column({ type: 'enum', enum: MotivoCierre, enumName: 'whatsapp_motivo_cierre_enum', nullable: true })
  motivoCierre: MotivoCierre | null;

  @Column({ type: 'uuid', nullable: true })
  cerradaPorId: string | null;

  @CreateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', transformer: TimezoneTransformer })
  updatedAt: Date;
}
