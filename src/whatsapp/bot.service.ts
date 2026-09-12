import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from './entities/WhatsappMensaje.entity';
import { ContactosService } from './contactos.service';
import { ConfigWhatsappService } from './config-whatsapp.service';
import { MensajesService } from './mensajes.service';
import { NotificacionesService } from './notificaciones.service';
import { WhatsappEventosService } from './whatsapp-eventos.service';
import { CLAVE_NO_SE, CLAVE_PERSONA, ClasificadorService, TurnoPrevio } from './clasificador.service';
import { esAtaque, permitirMensaje, pidePersona, recortar } from './guardia';
import { describirHorario, estaAbierto } from './horario';
import { aConversacionDto, etiquetaContacto } from './whatsapp.dto';
import {
  AutorMensaje,
  DireccionMensaje,
  EstadoConversacion,
  MotivoEspera,
  TipoMensaje,
  TipoNotificacion,
} from './whatsapp.enums';

/** Lo que postea el sidecar por cada mensaje recibido. */
export interface EntranteSidecar {
  chatJid: string;
  phone: string | null;
  pushName: string | null;
  waMessageId: string | null;
  kind: 'texto' | 'audio' | 'imagen' | 'documento' | 'otro';
  text: string;
  media: { base64: string; mime: string; fileName: string | null; seconds: number | null } | null;
  timestamp: number | null;
}

/** Ventana para juntar una ráfaga ("hola" / "quiero turno" / "para cejas") en una sola consulta. */
const DEBOUNCE_MS = 2_500;
/** Tope de un adjunto entrante que se guarda. */
const MAX_ADJUNTO_BYTES = 16 * 1024 * 1024;
const CHAT_JID_VALIDO = /^[0-9]{5,20}@(s\.whatsapp\.net|lid)$/;

const MOTIVO_LEGIBLE: Record<MotivoEspera, string> = {
  [MotivoEspera.PIDIO_PERSONA]: 'Pidió hablar con una persona',
  [MotivoEspera.NO_ENTENDIO]: 'El bot no entendió la consulta',
  [MotivoEspera.AUDIO]: 'Mandó un audio',
  [MotivoEspera.ARCHIVO]: 'Mandó una imagen o archivo',
  [MotivoEspera.RESPUESTA_DERIVA]: 'La consulta necesita seguimiento de una persona',
  [MotivoEspera.SEGURIDAD]: 'Mensaje sospechoso: lo revisa una persona',
  [MotivoEspera.BOT_APAGADO]: 'El bot está apagado',
  [MotivoEspera.SIN_CLASIFICADOR]: 'El clasificador no respondió',
};

/**
 * El bot. Recibe cada entrante, lo guarda y decide: responder con una
 * respuesta de la tabla, mostrar el menú, o pasar la charla a una persona.
 *
 * Mientras una charla está ESPERANDO o ATENDIDA el bot no dice nada: sólo
 * guarda y avisa.
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  /** conversacionId → textos acumulados + timer de la ráfaga. */
  private readonly rafagas = new Map<string, { textos: string[]; timer: NodeJS.Timeout }>();

  constructor(
    @InjectRepository(WhatsappConversacion)
    private readonly conversaciones: Repository<WhatsappConversacion>,
    @InjectRepository(WhatsappMensaje)
    private readonly mensajesRepo: Repository<WhatsappMensaje>,
    private readonly contactos: ContactosService,
    private readonly config: ConfigWhatsappService,
    private readonly mensajes: MensajesService,
    private readonly notificaciones: NotificacionesService,
    private readonly eventos: WhatsappEventosService,
    private readonly clasificador: ClasificadorService,
  ) {}

  async procesarEntrante(e: EntranteSidecar): Promise<void> {
    if (!e?.chatJid || !CHAT_JID_VALIDO.test(e.chatJid)) {
      this.logger.warn('Entrante con chatJid inválido, ignorado');
      return;
    }
    if (e.waMessageId && (await this.mensajesRepo.exist({ where: { waMessageId: e.waMessageId, direccion: DireccionMensaje.ENTRANTE } }))) {
      return; // el sidecar reintentó: ya lo tenemos
    }

    const contacto = await this.contactos.asegurar(e.chatJid, e.phone, e.pushName);
    const cfg = await this.config.obtener();
    let conv = await this.conversaciones.findOne({
      where: { contactoId: contacto.id, estado: Not(EstadoConversacion.CERRADA) },
      order: { createdAt: 'DESC' },
    });
    const nueva = !conv;
    if (!conv) {
      conv = await this.conversaciones.save(
        this.conversaciones.create({ contactoId: contacto.id, estado: EstadoConversacion.BOT }),
      );
      conv = (await this.conversaciones.findOne({ where: { id: conv.id } })) as WhatsappConversacion;
    }

    const { tipo, texto, adjunto } = await this.guardarContenido(e);
    await this.mensajes.registrarEntrante(conv, { tipo, texto, waMessageId: e.waMessageId, adjunto });
    await this.conversaciones.increment({ id: conv.id }, 'noLeidos', 1);
    conv.noLeidos += 1;
    await this.publicarConversacion(conv);

    if (conv.estado !== EstadoConversacion.BOT) {
      await this.avisarMensaje(conv, tipo, texto);
      return;
    }

    if (nueva) this.logger.log(`Charla nueva ${conv.id}`);

    if (!cfg.botActivo) {
      await this.derivar(conv, MotivoEspera.BOT_APAGADO, [cfg.mensajes.botApagado]);
      return;
    }
    if (!permitirMensaje(contacto.id)) {
      this.logger.warn(`Rate limit: contacto ${contacto.id}`);
      return;
    }

    if (tipo === TipoMensaje.AUDIO) {
      await this.derivar(conv, MotivoEspera.AUDIO, [cfg.mensajes.audioRecibido]);
      return;
    }
    if (tipo !== TipoMensaje.TEXTO) {
      await this.derivar(conv, MotivoEspera.ARCHIVO, [cfg.mensajes.archivoRecibido]);
      return;
    }

    const limpio = recortar(texto ?? '');
    if (!limpio) return;
    if (esAtaque(limpio)) {
      this.logger.warn(`Mensaje sospechoso en ${conv.id}: pasa a una persona`);
      await this.derivar(conv, MotivoEspera.SEGURIDAD, [cfg.mensajes.derivacion]);
      return;
    }
    if (pidePersona(limpio)) {
      await this.derivar(conv, MotivoEspera.PIDIO_PERSONA, [cfg.mensajes.derivacion]);
      return;
    }
    this.encolar(conv.id, limpio);
  }

  // ─── ráfaga / clasificación ────────────────────────────────────

  private encolar(conversacionId: string, texto: string): void {
    const actual = this.rafagas.get(conversacionId);
    if (actual) {
      clearTimeout(actual.timer);
      actual.textos.push(texto);
      actual.timer = setTimeout(() => void this.responder(conversacionId), DEBOUNCE_MS);
      return;
    }
    this.rafagas.set(conversacionId, {
      textos: [texto],
      timer: setTimeout(() => void this.responder(conversacionId), DEBOUNCE_MS),
    });
  }

  private async responder(conversacionId: string): Promise<void> {
    const rafaga = this.rafagas.get(conversacionId);
    this.rafagas.delete(conversacionId);
    if (!rafaga) return;
    const texto = rafaga.textos.join('\n');

    try {
      const conv = await this.conversaciones.findOne({ where: { id: conversacionId } });
      // Mientras esperábamos alguien pudo tomarla desde la web.
      if (!conv || conv.estado !== EstadoConversacion.BOT) return;
      const cfg = await this.config.obtener();

      if (conv.esperandoOpcionMenu) {
        const opcion = texto.trim();
        if (opcion === '3') {
          await this.derivar(conv, MotivoEspera.PIDIO_PERSONA, [cfg.mensajes.derivacion]);
          return;
        }
        const clave = opcion === '1' ? cfg.menuOpcion1 : opcion === '2' ? cfg.menuOpcion2 : null;
        if (clave) {
          const r = await this.config.respuestaPorClave(clave);
          if (r) {
            await this.responderCon(conv, r.clave, r.respuesta, r.derivaAPersona, cfg.mensajes.fueraDeHorario, cfg.horario);
            return;
          }
        }
      }

      const respuestas = await this.config.respuestasActivas();
      const contexto = await this.contextoReciente(conv.id);
      const { clave, disponible } = await this.clasificador.clasificar(texto, respuestas, contexto);

      if (!disponible) {
        // Sin clasificador no adivinamos: mejor una persona que una respuesta equivocada.
        await this.derivar(conv, MotivoEspera.SIN_CLASIFICADOR, [cfg.mensajes.derivacion]);
        return;
      }
      if (clave === CLAVE_PERSONA) {
        await this.derivar(conv, MotivoEspera.PIDIO_PERSONA, [cfg.mensajes.derivacion]);
        return;
      }
      if (clave === CLAVE_NO_SE) {
        if (conv.noEntendidosSeguidos + 1 >= 2) {
          await this.derivar(conv, MotivoEspera.NO_ENTENDIO, [cfg.mensajes.derivacion]);
          return;
        }
        await this.conversaciones.update(
          { id: conv.id },
          { noEntendidosSeguidos: conv.noEntendidosSeguidos + 1, esperandoOpcionMenu: true },
        );
        await this.mensajes.enviarTexto(conv, cfg.mensajes.noEntendi, AutorMensaje.BOT);
        return;
      }

      const r = respuestas.find((x) => x.clave === clave);
      if (!r) {
        await this.derivar(conv, MotivoEspera.NO_ENTENDIO, [cfg.mensajes.derivacion]);
        return;
      }
      await this.responderCon(conv, r.clave, r.respuesta, r.derivaAPersona, cfg.mensajes.fueraDeHorario, cfg.horario);
    } catch (error) {
      this.logger.error(`Error respondiendo en ${conversacionId}: ${(error as Error).message}`);
    }
  }

  private async responderCon(
    conv: WhatsappConversacion,
    clave: string,
    respuesta: string,
    derivaAPersona: boolean,
    fueraDeHorario: string,
    horario: { dias: number[]; desde: string; hasta: string },
  ): Promise<void> {
    await this.conversaciones.update({ id: conv.id }, { noEntendidosSeguidos: 0, esperandoOpcionMenu: false });
    await this.mensajes.enviarTexto(conv, respuesta, AutorMensaje.BOT, null, clave);
    if (derivaAPersona) {
      // La respuesta ya dice que sigue una persona; sólo si está cerrado se avisa el horario.
      await this.derivar(conv, MotivoEspera.RESPUESTA_DERIVA, [], { fueraDeHorario, horario });
    }
  }

  /** Últimos turnos de texto (sin el que se está clasificando), para respuestas cortas. */
  private async contextoReciente(conversacionId: string): Promise<TurnoPrevio[]> {
    const ultimos = await this.mensajesRepo.find({
      where: { conversacionId, tipo: TipoMensaje.TEXTO },
      order: { createdAt: 'DESC' },
      take: 7,
    });
    // El más nuevo es el mensaje actual (ya guardado): se saca.
    return ultimos
      .slice(1)
      .reverse()
      .filter((m) => m.texto)
      .map((m) => ({
        quien: m.autor === AutorMensaje.CLIENTA ? 'clienta' : 'bot',
        texto: recortar(m.texto as string).slice(0, 300),
      }));
  }

  // ─── derivación a persona ──────────────────────────────────────

  /**
   * Saca la charla del bot. Manda los textos dados y, si el local está
   * cerrado, el aviso de horario. Queda ESPERANDO hasta que alguien la tome.
   */
  private async derivar(
    conv: WhatsappConversacion,
    motivo: MotivoEspera,
    textos: string[],
    extra?: { fueraDeHorario: string; horario: { dias: number[]; desde: string; hasta: string } },
  ): Promise<void> {
    const cfg = extra ? null : await this.config.obtener();
    const horario = extra?.horario ?? (cfg as NonNullable<typeof cfg>).horario;
    const textoFuera = extra?.fueraDeHorario ?? (cfg as NonNullable<typeof cfg>).mensajes.fueraDeHorario;

    await this.conversaciones.update(
      { id: conv.id },
      {
        estado: EstadoConversacion.ESPERANDO,
        motivoEspera: motivo,
        esperandoDesde: new Date(),
        noEntendidosSeguidos: 0,
        esperandoOpcionMenu: false,
      },
    );
    conv.estado = EstadoConversacion.ESPERANDO;
    conv.motivoEspera = motivo;
    conv.esperandoDesde = new Date();
    this.rafagas.get(conv.id) && clearTimeout(this.rafagas.get(conv.id)!.timer);
    this.rafagas.delete(conv.id);

    for (const t of textos) await this.mensajes.enviarTexto(conv, t, AutorMensaje.BOT);
    if (!estaAbierto(horario)) {
      const aviso = textoFuera.replace('{horario}', describirHorario(horario));
      await this.mensajes.enviarTexto(conv, aviso, AutorMensaje.BOT);
    }

    await this.publicarConversacion(conv);
    const cliente = (await this.contactos.clientesDe([conv.contacto])).get(conv.contacto.clienteId ?? '') ?? null;
    await this.notificaciones.crear(
      TipoNotificacion.ESPERANDO,
      `${etiquetaContacto(conv.contacto, cliente)} espera una respuesta`,
      MOTIVO_LEGIBLE[motivo],
      conv.id,
    );
  }

  private async avisarMensaje(conv: WhatsappConversacion, tipo: TipoMensaje, texto: string | null): Promise<void> {
    const cliente = (await this.contactos.clientesDe([conv.contacto])).get(conv.contacto.clienteId ?? '') ?? null;
    const resumen =
      tipo === TipoMensaje.TEXTO
        ? (texto ?? '').slice(0, 140)
        : tipo === TipoMensaje.AUDIO
          ? '🎧 Audio'
          : tipo === TipoMensaje.IMAGEN
            ? '🖼️ Imagen'
            : tipo === TipoMensaje.DOCUMENTO
              ? '📎 Archivo'
              : 'Mensaje';
    await this.notificaciones.crear(
      TipoNotificacion.MENSAJE,
      etiquetaContacto(conv.contacto, cliente),
      resumen,
      conv.id,
    );
  }

  private async guardarContenido(e: EntranteSidecar): Promise<{
    tipo: TipoMensaje;
    texto: string | null;
    adjunto: { id: string; mimeType: string; nombreArchivo: string | null; tamanoBytes: number; duracionSegundos: number | null } | null;
  }> {
    const texto = (e.text ?? '').trim() || null;
    if (e.kind === 'texto') return { tipo: TipoMensaje.TEXTO, texto, adjunto: null };
    if (e.kind === 'otro' || !e.media?.base64) return { tipo: TipoMensaje.OTRO, texto, adjunto: null };

    const datos = Buffer.from(e.media.base64, 'base64');
    if (datos.length === 0 || datos.length > MAX_ADJUNTO_BYTES) {
      return { tipo: TipoMensaje.OTRO, texto, adjunto: null };
    }
    const mimeType = (e.media.mime || 'application/octet-stream').slice(0, 128);
    const guardado = await this.mensajes.guardarAdjunto(mimeType, datos);
    const tipo =
      e.kind === 'audio' ? TipoMensaje.AUDIO : e.kind === 'imagen' ? TipoMensaje.IMAGEN : TipoMensaje.DOCUMENTO;
    return {
      tipo,
      texto,
      adjunto: {
        id: guardado.id,
        mimeType,
        nombreArchivo: e.media.fileName ? String(e.media.fileName).slice(0, 255) : null,
        tamanoBytes: datos.length,
        duracionSegundos: e.media.seconds ?? null,
      },
    };
  }

  async publicarConversacion(conv: WhatsappConversacion): Promise<void> {
    const fresca = (await this.conversaciones.findOne({ where: { id: conv.id } })) ?? conv;
    const cliente = (await this.contactos.clientesDe([fresca.contacto])).get(fresca.contacto.clienteId ?? '') ?? null;
    const ultimo = await this.mensajesRepo.findOne({
      where: { conversacionId: fresca.id },
      order: { createdAt: 'DESC' },
    });
    this.eventos.publicar('conversacion', aConversacionDto(fresca, cliente, ultimo));
  }
}
