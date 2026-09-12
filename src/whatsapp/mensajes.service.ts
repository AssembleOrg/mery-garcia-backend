import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappAdjunto } from './entities/WhatsappAdjunto.entity';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from './entities/WhatsappMensaje.entity';
import { SidecarClient } from './sidecar.client';
import { WhatsappEventosService } from './whatsapp-eventos.service';
import { aMensajeDto } from './whatsapp.dto';
import { AutorMensaje, DireccionMensaje, EstadoEnvio, TipoMensaje } from './whatsapp.enums';

export interface AdjuntoSaliente {
  datos: Buffer;
  mimeType: string;
  nombreArchivo: string;
  duracionSegundos?: number | null;
}

/**
 * Persistencia y envío de mensajes, compartido por el bot y por la bandeja.
 * Todo lo que sale pasa por acá: se manda por el sidecar, se guarda y se
 * publica en vivo.
 */
@Injectable()
export class MensajesService {
  private readonly logger = new Logger(MensajesService.name);

  constructor(
    @InjectRepository(WhatsappMensaje)
    private readonly mensajes: Repository<WhatsappMensaje>,
    @InjectRepository(WhatsappAdjunto)
    private readonly adjuntos: Repository<WhatsappAdjunto>,
    @InjectRepository(WhatsappConversacion)
    private readonly conversaciones: Repository<WhatsappConversacion>,
    private readonly sidecar: SidecarClient,
    private readonly eventos: WhatsappEventosService,
  ) {}

  async guardarAdjunto(mimeType: string, datos: Buffer): Promise<WhatsappAdjunto> {
    return this.adjuntos.save(this.adjuntos.create({ mimeType, datos }));
  }

  async leerAdjunto(id: string): Promise<WhatsappAdjunto | null> {
    return this.adjuntos.findOne({ where: { id } });
  }

  /** Guarda un entrante ya recibido y avisa a la web. */
  async registrarEntrante(
    conv: WhatsappConversacion,
    datos: {
      tipo: TipoMensaje;
      texto: string | null;
      waMessageId: string | null;
      adjunto?: { id: string; mimeType: string; nombreArchivo: string | null; tamanoBytes: number; duracionSegundos: number | null } | null;
    },
  ): Promise<WhatsappMensaje> {
    const m = await this.mensajes.save(
      this.mensajes.create({
        conversacionId: conv.id,
        direccion: DireccionMensaje.ENTRANTE,
        autor: AutorMensaje.CLIENTA,
        tipo: datos.tipo,
        texto: datos.texto,
        waMessageId: datos.waMessageId,
        adjuntoId: datos.adjunto?.id ?? null,
        mimeType: datos.adjunto?.mimeType ?? null,
        nombreArchivo: datos.adjunto?.nombreArchivo ?? null,
        tamanoBytes: datos.adjunto?.tamanoBytes ?? null,
        duracionSegundos: datos.adjunto?.duracionSegundos ?? null,
      }),
    );
    const ahora = new Date();
    await this.conversaciones.update(
      { id: conv.id },
      { ultimoMensajeAt: ahora, ultimoEntranteAt: ahora, avisoInactividadAt: null },
    );
    conv.ultimoMensajeAt = ahora;
    conv.ultimoEntranteAt = ahora;
    conv.avisoInactividadAt = null;
    this.eventos.publicar('mensaje', aMensajeDto(m));
    return m;
  }

  /** Texto saliente (bot u operador). Si el sidecar falla queda como FALLIDO. */
  async enviarTexto(
    conv: WhatsappConversacion,
    texto: string,
    autor: AutorMensaje,
    operadorId: string | null = null,
    respuestaClave: string | null = null,
  ): Promise<WhatsappMensaje> {
    let waMessageId: string | null = null;
    let estado = EstadoEnvio.ENVIADO;
    try {
      waMessageId = await this.sidecar.enviarTexto(conv.contacto.chatJid, texto, true);
    } catch (error) {
      estado = EstadoEnvio.FALLIDO;
      this.logger.error(`No se pudo enviar texto a la conversación ${conv.id}: ${(error as Error).message}`);
    }
    return this.registrarSaliente(conv, {
      tipo: TipoMensaje.TEXTO,
      texto,
      autor,
      operadorId,
      respuestaClave,
      waMessageId,
      estado,
    });
  }

  /** Adjunto saliente de un operador: audio (nota de voz), imagen o documento. */
  async enviarAdjunto(
    conv: WhatsappConversacion,
    adjunto: AdjuntoSaliente,
    operadorId: string,
    caption: string | null,
  ): Promise<WhatsappMensaje> {
    const guardado = await this.guardarAdjunto(adjunto.mimeType, adjunto.datos);
    const esAudio = adjunto.mimeType.startsWith('audio/');
    const tipo = esAudio
      ? TipoMensaje.AUDIO
      : adjunto.mimeType.startsWith('image/')
        ? TipoMensaje.IMAGEN
        : TipoMensaje.DOCUMENTO;

    let waMessageId: string | null = null;
    let estado = EstadoEnvio.ENVIADO;
    try {
      waMessageId = esAudio
        ? await this.sidecar.enviarAudio(conv.contacto.chatJid, adjunto.datos)
        : await this.sidecar.enviarArchivo(
            conv.contacto.chatJid,
            adjunto.datos,
            adjunto.mimeType,
            adjunto.nombreArchivo,
            caption,
          );
    } catch (error) {
      estado = EstadoEnvio.FALLIDO;
      this.logger.error(`No se pudo enviar adjunto a la conversación ${conv.id}: ${(error as Error).message}`);
    }
    return this.registrarSaliente(conv, {
      tipo,
      texto: caption,
      autor: AutorMensaje.OPERADOR,
      operadorId,
      respuestaClave: null,
      waMessageId,
      estado,
      adjunto: {
        id: guardado.id,
        mimeType: adjunto.mimeType,
        nombreArchivo: esAudio ? null : adjunto.nombreArchivo,
        tamanoBytes: adjunto.datos.length,
        duracionSegundos: adjunto.duracionSegundos ?? null,
      },
    });
  }

  private async registrarSaliente(
    conv: WhatsappConversacion,
    datos: {
      tipo: TipoMensaje;
      texto: string | null;
      autor: AutorMensaje;
      operadorId: string | null;
      respuestaClave: string | null;
      waMessageId: string | null;
      estado: EstadoEnvio;
      adjunto?: { id: string; mimeType: string; nombreArchivo: string | null; tamanoBytes: number; duracionSegundos: number | null };
    },
  ): Promise<WhatsappMensaje> {
    const m = await this.mensajes.save(
      this.mensajes.create({
        conversacionId: conv.id,
        direccion: DireccionMensaje.SALIENTE,
        autor: datos.autor,
        operadorId: datos.operadorId,
        tipo: datos.tipo,
        texto: datos.texto,
        respuestaClave: datos.respuestaClave,
        waMessageId: datos.waMessageId,
        estadoEnvio: datos.estado,
        adjuntoId: datos.adjunto?.id ?? null,
        mimeType: datos.adjunto?.mimeType ?? null,
        nombreArchivo: datos.adjunto?.nombreArchivo ?? null,
        tamanoBytes: datos.adjunto?.tamanoBytes ?? null,
        duracionSegundos: datos.adjunto?.duracionSegundos ?? null,
        leidoAvisado: true,
      }),
    );
    const ahora = new Date();
    await this.conversaciones.update({ id: conv.id }, { ultimoMensajeAt: ahora });
    conv.ultimoMensajeAt = ahora;
    // El operador se ve en el DTO: recargar con la relación.
    const completo = datos.operadorId
      ? ((await this.mensajes.findOne({ where: { id: m.id } })) ?? m)
      : m;
    this.eventos.publicar('mensaje', aMensajeDto(completo));
    return completo;
  }
}
