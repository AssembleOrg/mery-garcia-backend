import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface HorarioAtencion {
  /** 1 = lunes … 7 = domingo. */
  dias: number[];
  /** HH:mm */
  desde: string;
  /** HH:mm */
  hasta: string;
}

/** Textos fijos del bot. Editables desde Configuración > WhatsApp. */
export interface MensajesBot {
  /** Primer mensaje de cada charla: con quién está hablando. {nombre} = nombre de la clienta. */
  presentacion: string;
  /** Igual, para alguien que ya es clienta (está en el sistema con ese celular). */
  presentacionClienta: string;
  /** Después de la presentación, si la clienta sólo saludó. */
  bienvenida: string;
  saludo: string;
  noEntendi: string;
  derivacion: string;
  fueraDeHorario: string;
  audioRecibido: string;
  archivoRecibido: string;
  avisoInactividad: string;
  despedida: string;
  botApagado: string;
  /** Derivación apagada (pruebas): lo que contesta cuando habría pasado la charla a recepción. */
  sinDerivacion: string;
}

/** Antes era "Por ahora te respondo yo 💕 ¿Te ayudo con alguna otra consulta?" (no guiaba). */
export const SIN_DERIVACION_POR_DEFECTO =
  'Te ayudo yo 💕 Puedo contarte sobre servicios, precios, turnos y formaciones.\n\n' +
  'Los turnos se reservan desde nuestra web, donde ves todas las disponibilidades: https://merygarciabooking.com\n' +
  'Formaciones: https://merygarcia.com.ar/formaciones\n\n' +
  '¿Qué te gustaría saber?';
export const SIN_DERIVACION_VIEJO = 'Por ahora te respondo yo 💕 ¿Te ayudo con alguna otra consulta?';

export const MENSAJES_POR_DEFECTO: MensajesBot = {
  presentacion: '¡Hola {nombre}! 💕 Te escribimos de *Mery García*.',
  presentacionClienta: '¡Hola {nombre}! 💕 Qué lindo tenerte de nuevo por acá. Te escribimos de *Mery García*.',
  bienvenida:
    '¿En qué te podemos ayudar? Podés consultarnos por servicios, precios, turnos o formaciones ✨',
  saludo: 'Hola! Como estas? 💕 ¿En qué te puedo ayudar?',
  noEntendi:
    'Perdón, no te entendí bien 🙈 ¿Sobre qué querés consultar?\n\n' +
    '1) Estilismo de cejas\n' +
    '2) Cosmetic tattoo (nanoblading, lip blush, lash line)\n' +
    '3) Hablar con recepción',
  derivacion: 'Te paso con recepción, en un ratito te responde 💕',
  fueraDeHorario:
    'En este momento estamos cerradas 🌙 Nuestro horario de atención es {horario}. ' +
    'Dejanos tu consulta y apenas abrimos te respondemos 💕',
  audioRecibido:
    'Recibí tu audio 🎧 En un ratito lo escucha recepción y te responde.',
  archivoRecibido:
    'Recibí lo que me mandaste 📎 En un ratito lo ve recepción y te responde.',
  avisoInactividad: '¿Seguís ahí? Si necesitás algo más, escribinos 💕',
  despedida: 'Gracias por escribirnos 💕 Cualquier cosa, acá estamos.',
  sinDerivacion: SIN_DERIVACION_POR_DEFECTO,
  botApagado: 'Hola! Gracias por escribirnos 💕 En un ratito te responde recepción.',
};

export const HORARIO_POR_DEFECTO: HorarioAtencion = {
  dias: [1, 2, 3, 4, 5, 6],
  desde: '10:00',
  hasta: '19:00',
};

/** Una sola fila. */
@Entity({ name: 'whatsapp_config' })
export class WhatsappConfig {
  @PrimaryColumn({ type: 'varchar', length: 16, default: 'default' })
  id: string;

  /** Apagado: todo entrante pasa directo a una persona. */
  @Column({ type: 'boolean', default: true })
  botActivo: boolean;

  /**
   * Pasar charlas a recepción. Apagado (modo pruebas) el bot nunca deriva: en vez
   * de "te paso con recepción" contesta `mensajes.sinDerivacion` y sigue él.
   */
  @Column({ type: 'boolean', default: false })
  derivacionActiva: boolean;

  /**
   * El bot sólo contesta en los chats donde alguien escribió "Mery on". En el
   * resto no dice nada (el mensaje igual queda en la bandeja).
   */
  @Column({ type: 'boolean', default: true })
  soloChatsConComando: boolean;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(HORARIO_POR_DEFECTO)}'` })
  horario: HorarioAtencion;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(MENSAJES_POR_DEFECTO).replace(/'/g, "''")}'` })
  mensajes: MensajesBot;

  /** Clave de respuesta para la opción 1 y 2 del menú de "no entendí". */
  @Column({ type: 'varchar', length: 64, default: 'CEJAS_TURNO_PERFILADO' })
  menuOpcion1: string;

  @Column({ type: 'varchar', length: 64, default: 'TATTOO_CONSULTA_TURNO' })
  menuOpcion2: string;

  /** Última tanda de respuestas de ejemplo agregada a la tabla (ver respuestas-v2.seed). */
  @Column({ type: 'integer', default: 1 })
  semillaVersion: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
