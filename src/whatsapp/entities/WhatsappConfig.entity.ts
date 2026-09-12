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
  saludo: string;
  noEntendi: string;
  derivacion: string;
  fueraDeHorario: string;
  audioRecibido: string;
  archivoRecibido: string;
  avisoInactividad: string;
  despedida: string;
  botApagado: string;
}

export const MENSAJES_POR_DEFECTO: MensajesBot = {
  saludo: 'Hola! Como estas? 💕 ¿En qué te puedo ayudar?',
  noEntendi:
    'Perdón, no te entendí bien 🙈 ¿Sobre qué querés consultar?\n\n' +
    '1) Estilismo de cejas\n' +
    '2) Cosmetic tattoo (nanoblading, lip blush, lash line)\n' +
    '3) Hablar con una persona del equipo',
  derivacion: 'Te paso con una persona del equipo, en un ratito te responde 💕',
  fueraDeHorario:
    'En este momento estamos cerradas 🌙 Nuestro horario de atención es {horario}. ' +
    'Dejanos tu consulta y apenas abrimos te respondemos 💕',
  audioRecibido:
    'Recibí tu audio 🎧 En un ratito lo escucha alguien del equipo y te responde.',
  archivoRecibido:
    'Recibí lo que me mandaste 📎 En un ratito lo ve alguien del equipo y te responde.',
  avisoInactividad: '¿Seguís ahí? Si necesitás algo más, escribinos 💕',
  despedida: 'Gracias por escribirnos 💕 Cualquier cosa, acá estamos.',
  botApagado: 'Hola! Gracias por escribirnos 💕 En un ratito te responde alguien del equipo.',
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

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(HORARIO_POR_DEFECTO)}'` })
  horario: HorarioAtencion;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(MENSAJES_POR_DEFECTO).replace(/'/g, "''")}'` })
  mensajes: MensajesBot;

  /** Clave de respuesta para la opción 1 y 2 del menú de "no entendí". */
  @Column({ type: 'varchar', length: 64, default: 'CEJAS_TURNO_PERFILADO' })
  menuOpcion1: string;

  @Column({ type: 'varchar', length: 64, default: 'TATTOO_CONSULTA_TURNO' })
  menuOpcion2: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
