import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Una pregunta frecuente y su respuesta, tal cual la escribió Mery.
 *
 * El modelo recibe `clave`, `descripcion` y `ejemplos` para decidir cuál
 * aplica; lo que sale hacia la clienta es `respuesta`, palabra por palabra.
 * Así el bot no puede inventar un precio ni un día: no escribe, elige.
 */
@Entity({ name: 'whatsapp_respuesta' })
export class WhatsappRespuesta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador estable, MAYUSCULAS_CON_GUION. Es lo que devuelve el modelo. */
  @Index('ux_whatsapp_respuesta_clave', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  clave: string;

  /** Cómo se ve en el panel. */
  @Column({ type: 'varchar', length: 160 })
  titulo: string;

  /** Cuándo aplica, en una frase. Lo lee el modelo. */
  @Column({ type: 'text' })
  descripcion: string;

  /** Formas en que una clienta lo pregunta. Lo lee el modelo. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ejemplos: string[];

  @Column({ type: 'text' })
  respuesta: string;

  /** Después de responder, la charla pasa a una persona (ej. clienta del interior). */
  @Column({ type: 'boolean', default: false })
  derivaAPersona: boolean;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @Column({ type: 'integer', default: 0 })
  orden: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
