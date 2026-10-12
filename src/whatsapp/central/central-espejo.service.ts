import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'rxjs';
import { Not, Repository } from 'typeorm';
import { WhatsappContacto } from '../entities/WhatsappContacto.entity';
import { WhatsappConversacion } from '../entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from '../entities/WhatsappMensaje.entity';
import { BandejaService } from '../bandeja.service';
import { MensajesService } from '../mensajes.service';
import { SidecarClient } from '../sidecar.client';
import { WhatsappEventosService } from '../whatsapp-eventos.service';
import { ConversacionDto, MensajeDto } from '../whatsapp.dto';
import {
  AutorMensaje,
  DireccionMensaje,
  EstadoConversacion,
  EstadoEnvio,
  MotivoCierre,
  TipoMensaje,
} from '../whatsapp.enums';
import { CentralClient } from './central.client';
import { CentralModoService } from './central-modo.service';

/**
 * Marca los mensajes que escribió un operador desde la central. La central ya
 * los tiene guardados: no hay que reflejárselos de vuelta.
 */
export const CLAVE_CENTRAL = 'CENTRAL';

const CANAL_CADA_MS = 30_000;
const CANAL_REPETIR_MS = 5 * 60_000;
const REINTENTO_STREAM_MS = 5_000;
const MAX_ADJUNTO_BYTES = 16 * 1024 * 1024;
/** Un cierre se refleja sólo si acaba de pasar (ver reflejarEstado). */
const CIERRE_RECIENTE_MS = 2 * 60_000;

interface Comando {
  type?: string;
  phone?: string;
  body?: string;
  media_url?: string;
  conversation_id?: string;
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Espejo del WhatsApp de Mery en la central de chatbots.
 *
 * El bot de Mery no corre sobre el motor de la central: tiene su propia
 * configuración, su clasificador y su bandeja, y eso no cambia. Este servicio
 * lo hace "vivir también" en la central, hablando el mismo contrato que un
 * motor:
 *
 *  - Hacia la central: cada mensaje y cada cambio de estado de una charla, y
 *    el estado de la conexión de WhatsApp.
 *  - Desde la central: lo que un operador hace en su panel (escribir, tomar,
 *    devolver al bot, cerrar) y la configuración del modo prueba.
 *
 * Escucha el bus interno de eventos, así que no toca el flujo del bot. Si la
 * central no está configurada no hace nada; si está caída, se loguea y el
 * WhatsApp sigue funcionando igual.
 *
 * Ante la duda entre los dos lados gana "la atiende una persona": el bot
 * nunca le habla encima a alguien del equipo.
 */
@Injectable()
export class CentralEspejoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CentralEspejoService.name);
  private suscripcion?: Subscription;
  private temporizadorCanal?: NodeJS.Timeout;
  private cortarStream?: AbortController;
  private detenido = false;

  /** Una cola por charla: los mensajes llegan a la central en orden. */
  private readonly colas = new Map<string, Promise<void>>();
  /** Último estado de cada charla que la central ya conoce. */
  private readonly sincronizado = new Map<string, EstadoConversacion>();
  private colaComandos: Promise<void> = Promise.resolve();
  private ultimoCanal: string | null = null;
  private ultimoCanalAt = 0;

  constructor(
    private readonly central: CentralClient,
    private readonly modo: CentralModoService,
    private readonly eventos: WhatsappEventosService,
    private readonly sidecar: SidecarClient,
    private readonly mensajes: MensajesService,
    private readonly bandeja: BandejaService,
    @InjectRepository(WhatsappContacto)
    private readonly contactos: Repository<WhatsappContacto>,
    @InjectRepository(WhatsappConversacion)
    private readonly conversaciones: Repository<WhatsappConversacion>,
    @InjectRepository(WhatsappMensaje)
    private readonly mensajesRepo: Repository<WhatsappMensaje>,
  ) {}

  onModuleInit(): void {
    if (!this.central.configurada) {
      this.logger.log('Central de chatbots sin configurar: el bot funciona sólo con su configuración local');
      return;
    }
    void this.cargarConfig();

    this.suscripcion = this.eventos.stream().subscribe((evento) => {
      if (evento.type === 'mensaje') {
        const m = evento.data as MensajeDto;
        this.encolar(m.conversacionId, () => this.reflejarMensaje(m));
      } else if (evento.type === 'conversacion') {
        const c = evento.data as ConversacionDto;
        this.encolar(c.id, () => this.reflejarEstado(c));
      }
    });

    void this.escucharComandos();
    void this.reportarCanal();
    this.temporizadorCanal = setInterval(() => void this.reportarCanal(), CANAL_CADA_MS);
    this.logger.log('Central de chatbots conectada: el bot se refleja en la central');
  }

  onModuleDestroy(): void {
    this.detenido = true;
    this.suscripcion?.unsubscribe();
    if (this.temporizadorCanal) clearInterval(this.temporizadorCanal);
    this.cortarStream?.abort();
  }

  // ─── Mery → central ────────────────────────────────────────────

  private encolar(clave: string, tarea: () => Promise<void>): void {
    const previa = this.colas.get(clave) ?? Promise.resolve();
    const siguiente = previa
      .then(tarea)
      .catch((error: Error) => this.logger.warn(`No se pudo reflejar en la central: ${error.message}`))
      .finally(() => {
        if (this.colas.get(clave) === siguiente) this.colas.delete(clave);
      });
    this.colas.set(clave, siguiente);
  }

  private async reflejarMensaje(m: MensajeDto): Promise<void> {
    if (m.respuestaClave === CLAVE_CENTRAL) return;
    const entrante = m.direccion === DireccionMensaje.ENTRANTE;
    if (!entrante && m.estadoEnvio === EstadoEnvio.FALLIDO) return;

    const conv = await this.conversaciones.findOne({ where: { id: m.conversacionId } });
    if (!conv) return;
    // Con cada entrante se vuelve a pedir la charla: la central la reabre si
    // estaba cerrada y avisa si alguien la tomó desde su panel.
    const charla = await this.asegurar(conv.contacto, entrante);

    let mediaUrl: string | null = null;
    if (m.adjunto) {
      const fila = await this.mensajesRepo.findOne({ where: { id: m.id }, select: { id: true, adjuntoId: true } });
      const adjunto = fila?.adjuntoId ? await this.mensajes.leerAdjunto(fila.adjuntoId) : null;
      if (adjunto) {
        mediaUrl = await this.central.subirArchivo(adjunto.datos, adjunto.mimeType, m.adjunto.nombreArchivo ?? 'archivo');
      }
    }

    const sinTexto = m.tipo === TipoMensaje.AUDIO ? '🎤 audio' : '📎 archivo';
    await this.central.registrarMensaje({
      conversation_id: charla.id,
      direction: entrante ? 'inbound' : 'outbound',
      sender: entrante ? 'customer' : m.autor === AutorMensaje.BOT ? 'bot' : 'agent',
      body: m.texto ?? (m.tipo === TipoMensaje.TEXTO ? null : sinTexto),
      media_url: mediaUrl,
      meta: { origen: 'mery', mensaje_id: m.id, operador: m.operador?.nombre ?? null },
    });

    if (entrante && charla.pausada && conv.estado === EstadoConversacion.BOT) {
      await this.pausarLocal(conv);
    }
  }

  private async reflejarEstado(c: ConversacionDto): Promise<void> {
    const previo = this.sincronizado.get(c.id);
    if (previo === c.estado) {
      if (c.estado === EstadoConversacion.CERRADA) this.sincronizado.delete(c.id);
      return;
    }
    // Charla nueva que arranca con el bot: la central la crea así, no hay nada que avisar.
    if (previo === undefined && c.estado === EstadoConversacion.BOT) {
      this.sincronizado.set(c.id, c.estado);
      return;
    }

    const conv = await this.conversaciones.findOne({ where: { id: c.id } });
    if (!conv) return;

    // La central tiene UNA charla por número; acá puede haber varias en el
    // tiempo. Un evento de una charla vieja ya cerrada (alguien la abrió para
    // releerla) no puede tocar la charla actual de ese contacto en la central.
    if (c.estado === EstadoConversacion.CERRADA) {
      const recienCerrada =
        !!conv.cerradaAt && Date.now() - new Date(conv.cerradaAt).getTime() < CIERRE_RECIENTE_MS;
      const hayOtraAbierta = !!(await this.charlaAbierta(conv.contactoId));
      if (hayOtraAbierta || (previo === undefined && !recienCerrada)) return;
    }

    const charla = await this.asegurar(conv.contacto, false);

    switch (c.estado) {
      case EstadoConversacion.ESPERANDO:
        // El aviso de "pidió una persona" sólo cuando de verdad venía del bot;
        // si no, alcanza con dejarla pausada.
        if (previo === EstadoConversacion.BOT) {
          const derivada = await this.central
            .derivar(charla.id, c.motivoEspera ?? 'pasa a una persona')
            .then((r) => r?.ok !== false)
            .catch(() => false);
          if (!derivada) await this.central.tomar(charla.id);
        } else {
          await this.central.tomar(charla.id);
        }
        break;
      case EstadoConversacion.ATENDIDA:
        await this.central.tomar(charla.id);
        break;
      case EstadoConversacion.BOT:
        await this.central.devolverAlBot(charla.id);
        break;
      case EstadoConversacion.CERRADA:
        // La central no cierra una charla que atiende una persona: primero vuelve al bot.
        await this.central.devolverAlBot(charla.id).catch(() => undefined);
        await this.central.cerrar(charla.id);
        break;
    }

    if (c.estado === EstadoConversacion.CERRADA) this.sincronizado.delete(c.id);
    else this.sincronizado.set(c.id, c.estado);
  }

  /** Charla de este contacto en la central (una por número). */
  private async asegurar(
    contacto: WhatsappContacto,
    refrescar: boolean,
  ): Promise<{ id: string; pausada: boolean }> {
    if (!refrescar && contacto.centralConversationId) {
      return { id: contacto.centralConversationId, pausada: false };
    }
    const r = await this.central.upsertConversacion(this.claveDe(contacto), contacto.nombreWhatsapp);
    if (r.conversation_id !== contacto.centralConversationId) {
      await this.contactos.update({ id: contacto.id }, { centralConversationId: r.conversation_id });
      contacto.centralConversationId = r.conversation_id;
    }
    return { id: r.conversation_id, pausada: r.paused };
  }

  /**
   * Cómo se llama el contacto en la central. El teléfono real si se conoce;
   * si WhatsApp sólo dio un LID (un id opaco, no un número), se manda marcado
   * como tal para no hacerlo pasar por un teléfono.
   */
  private claveDe(contacto: WhatsappContacto): string {
    return contacto.telefono ? `+${contacto.telefono}` : `lid:${contacto.chatJid.split('@')[0]}`;
  }

  private contactoPorClave(clave: string): Promise<WhatsappContacto | null> {
    if (clave.startsWith('lid:')) {
      return this.contactos.findOne({ where: { chatJid: `${clave.slice(4)}@lid` } });
    }
    const digitos = clave.replace(/\D/g, '');
    return digitos ? this.contactos.findOne({ where: { telefono: digitos } }) : Promise.resolve(null);
  }

  private charlaAbierta(contactoId: string): Promise<WhatsappConversacion | null> {
    return this.conversaciones.findOne({
      where: { contactoId, estado: Not(EstadoConversacion.CERRADA) },
      order: { createdAt: 'DESC' },
    });
  }

  private async charlaAbiertaDeCentral(centralId: string | undefined): Promise<WhatsappConversacion | null> {
    if (!centralId) return null;
    const contacto = await this.contactos.findOne({ where: { centralConversationId: centralId } });
    return contacto ? this.charlaAbierta(contacto.id) : null;
  }

  private async publicar(id: string): Promise<void> {
    this.eventos.publicar('conversacion', await this.bandeja.obtener(id));
  }

  /** La atiende alguien desde la central: el bot deja de contestar en esa charla. */
  private async pausarLocal(conv: WhatsappConversacion): Promise<void> {
    if (conv.estado === EstadoConversacion.ATENDIDA) return;
    this.sincronizado.set(conv.id, EstadoConversacion.ATENDIDA);
    await this.conversaciones.update(
      { id: conv.id },
      { estado: EstadoConversacion.ATENDIDA, atendidaPorId: null, avisoInactividadAt: null },
    );
    conv.estado = EstadoConversacion.ATENDIDA;
    await this.publicar(conv.id);
  }

  // ─── central → Mery ────────────────────────────────────────────

  private async cargarConfig(): Promise<void> {
    try {
      const cfg = await this.central.obtenerConfig();
      this.modo.aplicar(cfg.features?.test_mode);
      this.logger.log(`Central: modo prueba ${this.modo.pruebaActiva ? 'PRENDIDO' : 'apagado'}`);
    } catch (error) {
      this.logger.warn(`No se pudo leer la configuración de la central: ${(error as Error).message}`);
    }
  }

  /** Stream de órdenes de la central (SSE). Se reconecta solo. */
  private async escucharComandos(): Promise<void> {
    while (!this.detenido) {
      try {
        this.cortarStream = new AbortController();
        const res = await fetch(this.central.urlComandos, {
          headers: { ...this.central.cabeceras, Accept: 'text/event-stream' },
          signal: this.cortarStream.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream de comandos → ${res.status}`);
        this.logger.log('Central: stream de comandos conectado');

        const lector = res.body.getReader();
        const decodificador = new TextDecoder();
        let pendiente = '';
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          pendiente = (pendiente + decodificador.decode(value, { stream: true })).replace(/\r\n/g, '\n');
          let corte: number;
          while ((corte = pendiente.indexOf('\n\n')) >= 0) {
            this.recibirBloque(pendiente.slice(0, corte));
            pendiente = pendiente.slice(corte + 2);
          }
        }
      } catch (error) {
        if (this.detenido) return;
        this.logger.warn(`Central: stream de comandos caído (${(error as Error).message}), reintento`);
      }
      if (!this.detenido) await esperar(REINTENTO_STREAM_MS);
    }
  }

  private recibirBloque(bloque: string): void {
    const datos = bloque
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n');
    if (!datos) return;
    let cmd: Comando;
    try {
      cmd = JSON.parse(datos) as Comando;
    } catch {
      return;
    }
    // De a uno y en orden: un "enviar" seguido de un "cerrar" tiene que respetarse.
    this.colaComandos = this.colaComandos
      .then(() => this.ejecutar(cmd))
      .catch((error: Error) => this.logger.warn(`Central: falló el comando ${cmd.type}: ${error.message}`));
  }

  private async ejecutar(cmd: Comando): Promise<void> {
    switch (cmd.type) {
      case 'send':
        return this.ordenEnviar(cmd);
      case 'takeover': {
        const conv = await this.charlaAbiertaDeCentral(cmd.conversation_id);
        if (conv) await this.pausarLocal(conv);
        return;
      }
      case 'resume': {
        const conv = await this.charlaAbiertaDeCentral(cmd.conversation_id);
        if (!conv || conv.estado === EstadoConversacion.BOT) return;
        this.sincronizado.set(conv.id, EstadoConversacion.BOT);
        await this.bandeja.devolverAlBot(conv.id);
        return;
      }
      case 'close': {
        const conv = await this.charlaAbiertaDeCentral(cmd.conversation_id);
        if (!conv) return;
        // Para que el evento que sale ahora no rebote hacia la central
        // (reflejarEstado lo ve igual y limpia la marca).
        this.sincronizado.set(conv.id, EstadoConversacion.CERRADA);
        await this.conversaciones.update(
          { id: conv.id },
          {
            estado: EstadoConversacion.CERRADA,
            cerradaAt: new Date(),
            motivoCierre: MotivoCierre.ATENDIDA,
            noLeidos: 0,
            esperandoOpcionMenu: false,
          },
        );
        await this.publicar(conv.id);
        return;
      }
      case 'reload':
        return this.cargarConfig();
      case 'relink':
        return this.sidecar.refrescarSesion();
      case 'logout':
        return this.sidecar.cerrarSesion();
      default:
        return;
    }
  }

  /** Un operador escribió desde el panel de la central. */
  private async ordenEnviar(cmd: Comando): Promise<void> {
    const contacto = cmd.phone ? await this.contactoPorClave(cmd.phone) : null;
    if (!contacto) {
      this.logger.warn('Central pidió enviar a un contacto que este WhatsApp no conoce');
      return;
    }
    let conv = await this.charlaAbierta(contacto.id);
    if (!conv) {
      const nueva = await this.conversaciones.save(
        this.conversaciones.create({ contactoId: contacto.id, estado: EstadoConversacion.ATENDIDA }),
      );
      this.sincronizado.set(nueva.id, EstadoConversacion.ATENDIDA);
      conv = (await this.conversaciones.findOne({ where: { id: nueva.id } })) as WhatsappConversacion;
    }
    await this.pausarLocal(conv);

    const texto = (cmd.body ?? '').trim();
    if (cmd.media_url) {
      const archivo = await this.descargar(cmd.media_url);
      if (archivo) {
        await this.mensajes.enviarAdjunto(conv, archivo, null, texto || null, CLAVE_CENTRAL);
      } else if (texto) {
        await this.mensajes.enviarTexto(conv, texto, AutorMensaje.OPERADOR, null, CLAVE_CENTRAL);
      }
    } else if (texto) {
      await this.mensajes.enviarTexto(conv, texto, AutorMensaje.OPERADOR, null, CLAVE_CENTRAL);
    }
    await this.publicar(conv.id);
  }

  private async descargar(
    url: string,
  ): Promise<{ datos: Buffer; mimeType: string; nombreArchivo: string } | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${res.status}`);
      const datos = Buffer.from(await res.arrayBuffer());
      if (datos.length > MAX_ADJUNTO_BYTES) throw new Error('archivo demasiado grande');
      const mimeType = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim();
      const nombreArchivo = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'archivo');
      return { datos, mimeType, nombreArchivo };
    } catch (error) {
      this.logger.warn(`No se pudo bajar el adjunto que mandó la central: ${(error as Error).message}`);
      return null;
    }
  }

  // ─── conexión de WhatsApp ──────────────────────────────────────

  private async reportarCanal(): Promise<void> {
    try {
      const e = await this.sidecar.estado();
      const estado =
        e.configurado && e.alcanzable && e.connected && e.loggedIn
          ? 'connected'
          : e.alcanzable && e.qr
            ? 'qr_pending'
            : 'disconnected';
      const ahora = Date.now();
      if (estado === this.ultimoCanal && ahora - this.ultimoCanalAt < CANAL_REPETIR_MS) return;
      // El QR no viaja: el sidecar lo entrega como imagen y la central espera el
      // texto. La vinculación se sigue haciendo desde el sistema de Mery.
      await this.central.estadoCanal(estado);
      this.ultimoCanal = estado;
      this.ultimoCanalAt = ahora;
    } catch (error) {
      this.logger.warn(`No se pudo reportar la conexión a la central: ${(error as Error).message}`);
    }
  }
}
