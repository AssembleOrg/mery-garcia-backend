import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from './entities/WhatsappMensaje.entity';
import { ContactosService } from './contactos.service';
import { ConfigWhatsappService } from './config-whatsapp.service';
import { MensajesService } from './mensajes.service';
import { SidecarClient } from './sidecar.client';
import { WhatsappEventosService } from './whatsapp-eventos.service';
import { ConversacionDto, MensajeDto, aConversacionDto, aMensajeDto } from './whatsapp.dto';
import { soloDigitos } from './telefono';
import { AutorMensaje, DireccionMensaje, EstadoConversacion, MotivoCierre } from './whatsapp.enums';

export type FiltroEstado = 'ABIERTAS' | EstadoConversacion;

export interface ListarParams {
  estado?: FiltroEstado;
  q?: string;
  /** YYYY-MM-DD: charlas con actividad ese día. */
  dia?: string;
  pagina?: number;
  porPagina?: number;
}

export interface Operador {
  id: string;
  nombre: string;
}

const MAX_TEXTO = 4096;
export const MAX_ADJUNTO_BYTES = 16 * 1024 * 1024;
export const MIMES_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'application/pdf',
]);

/** Lo que hace una persona del equipo desde la web. */
@Injectable()
export class BandejaService {
  private readonly logger = new Logger(BandejaService.name);

  constructor(
    @InjectRepository(WhatsappConversacion)
    private readonly conversaciones: Repository<WhatsappConversacion>,
    @InjectRepository(WhatsappMensaje)
    private readonly mensajesRepo: Repository<WhatsappMensaje>,
    private readonly contactos: ContactosService,
    private readonly config: ConfigWhatsappService,
    private readonly mensajes: MensajesService,
    private readonly sidecar: SidecarClient,
    private readonly eventos: WhatsappEventosService,
  ) {}

  async listar(p: ListarParams): Promise<{ items: ConversacionDto[]; total: number; esperando: number; noLeidos: number }> {
    const porPagina = Math.min(Math.max(Number(p.porPagina) || 30, 1), 100);
    const pagina = Math.max(Number(p.pagina) || 1, 1);

    const qb = this.conversaciones
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.contacto', 'contacto')
      .leftJoinAndSelect('c.atendidaPor', 'atendidaPor');

    if (p.estado === 'ABIERTAS') {
      qb.andWhere('c.estado IN (:...abiertas)', { abiertas: [EstadoConversacion.ESPERANDO, EstadoConversacion.ATENDIDA] });
    } else if (p.estado && Object.values(EstadoConversacion).includes(p.estado)) {
      qb.andWhere('c.estado = :estado', { estado: p.estado });
    }
    if (p.dia && /^\d{4}-\d{2}-\d{2}$/.test(p.dia)) {
      qb.andWhere(
        `(c."ultimoMensajeAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = :dia::date`,
        { dia: p.dia },
      );
    }
    const q = (p.q ?? '').trim();
    if (q) {
      const digitos = soloDigitos(q);
      qb.andWhere(
        new Brackets((w) => {
          w.where('contacto.nombreWhatsapp ILIKE :q', { q: `%${q}%` });
          if (digitos.length >= 4) w.orWhere('contacto.telefono LIKE :tel', { tel: `%${digitos}%` });
          w.orWhere(
            `contacto."clienteId" IN (SELECT id FROM clientes WHERE nombre ILIKE :q AND "deletedAt" IS NULL)`,
          );
        }),
      );
    }

    // Los joins son many-to-one (una fila por charla): limit/offset directos.
    // skip/take con un ORDER BY por expresión dispara la consulta en dos
    // fases de TypeORM, que no sabe seleccionar el CASE.
    qb.orderBy(
      `CASE c.estado WHEN '${EstadoConversacion.ESPERANDO}' THEN 0 ELSE 1 END`,
      'ASC',
    )
      .addOrderBy('c.ultimoMensajeAt', 'DESC', 'NULLS LAST')
      .offset((pagina - 1) * porPagina)
      .limit(porPagina);

    const [filas, total] = await qb.getManyAndCount();
    const items = await this.aDtos(filas);

    const [esperando, noLeidosRaw] = await Promise.all([
      this.conversaciones.count({ where: { estado: EstadoConversacion.ESPERANDO } }),
      this.conversaciones
        .createQueryBuilder('c')
        .select('COALESCE(SUM(c.noLeidos), 0)', 'total')
        .where('c.estado IN (:...abiertas)', { abiertas: [EstadoConversacion.ESPERANDO, EstadoConversacion.ATENDIDA] })
        .getRawOne<{ total: string }>(),
    ]);

    return { items, total, esperando, noLeidos: Number(noLeidosRaw?.total ?? 0) };
  }

  async obtener(id: string): Promise<ConversacionDto> {
    const conv = await this.cargar(id);
    return (await this.aDtos([conv]))[0];
  }

  /**
   * Mensajes de una charla (más viejos primero). Abrirla desde la web cuenta
   * como leerla: se ponen a cero los no leídos y se avisa a WhatsApp.
   */
  async mensajesDe(id: string, antesDe?: string, limite = 60): Promise<{ conversacion: ConversacionDto; mensajes: MensajeDto[]; hayMas: boolean }> {
    const conv = await this.cargar(id);
    const take = Math.min(Math.max(limite, 1), 200);
    const qb = this.mensajesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.operador', 'operador')
      .where('m.conversacionId = :id', { id })
      .orderBy('m.createdAt', 'DESC')
      .limit(take + 1);
    if (antesDe && !Number.isNaN(Date.parse(antesDe))) {
      qb.andWhere('m.createdAt < :antesDe', { antesDe: new Date(antesDe) });
    }
    const filas = await qb.getMany();
    const hayMas = filas.length > take;
    const pagina = filas.slice(0, take).reverse();

    await this.marcarLeida(conv);
    return { conversacion: (await this.aDtos([conv]))[0], mensajes: pagina.map(aMensajeDto), hayMas };
  }

  async tomar(id: string, operador: Operador): Promise<ConversacionDto> {
    const conv = await this.cargar(id);
    if (conv.estado === EstadoConversacion.CERRADA) {
      throw new BadRequestException('La charla está cerrada. Escribile para reabrirla.');
    }
    await this.conversaciones.update(
      { id },
      { estado: EstadoConversacion.ATENDIDA, atendidaPorId: operador.id, avisoInactividadAt: null },
    );
    return this.publicar(id);
  }

  async devolverAlBot(id: string): Promise<ConversacionDto> {
    const conv = await this.cargar(id);
    if (conv.estado === EstadoConversacion.CERRADA) throw new BadRequestException('La charla está cerrada.');
    await this.conversaciones.update(
      { id },
      {
        estado: EstadoConversacion.BOT,
        atendidaPorId: null,
        motivoEspera: null,
        esperandoDesde: null,
        noEntendidosSeguidos: 0,
        esperandoOpcionMenu: false,
        avisoInactividadAt: null,
      },
    );
    return this.publicar(id);
  }

  async enviarTexto(id: string, operador: Operador, texto: string): Promise<MensajeDto> {
    const limpio = (texto ?? '').trim();
    if (!limpio) throw new BadRequestException('El mensaje está vacío.');
    if (limpio.length > MAX_TEXTO) throw new BadRequestException(`Máximo ${MAX_TEXTO} caracteres.`);
    const conv = await this.tomarAlEscribir(id, operador);
    const m = await this.mensajes.enviarTexto(conv, limpio, AutorMensaje.OPERADOR, operador.id);
    await this.publicar(id);
    return aMensajeDto(m);
  }

  async enviarAdjunto(
    id: string,
    operador: Operador,
    archivo: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    caption: string | null,
    duracionSegundos: number | null,
  ): Promise<MensajeDto> {
    const mime = (archivo.mimetype ?? '').split(';')[0].trim().toLowerCase();
    if (!MIMES_PERMITIDOS.has(mime)) {
      throw new BadRequestException('Formato no permitido. Se aceptan imágenes (jpg, png, webp), audios y PDF.');
    }
    if (!archivo.buffer?.length) throw new BadRequestException('El archivo está vacío.');
    if (archivo.size > MAX_ADJUNTO_BYTES) throw new BadRequestException('El archivo supera los 16 MB.');
    const textoCaption = (caption ?? '').trim().slice(0, 1024) || null;

    const conv = await this.tomarAlEscribir(id, operador);
    const m = await this.mensajes.enviarAdjunto(
      conv,
      {
        datos: archivo.buffer,
        mimeType: mime,
        nombreArchivo: (archivo.originalname || 'archivo').slice(0, 255),
        duracionSegundos,
      },
      operador.id,
      textoCaption,
    );
    await this.publicar(id);
    return aMensajeDto(m);
  }

  async cerrar(id: string, operador: Operador, conDespedida: boolean): Promise<ConversacionDto> {
    const conv = await this.cargar(id);
    if (conv.estado === EstadoConversacion.CERRADA) return (await this.aDtos([conv]))[0];
    if (conDespedida) {
      const cfg = await this.config.obtener();
      await this.mensajes.enviarTexto(conv, cfg.mensajes.despedida, AutorMensaje.OPERADOR, operador.id);
    }
    await this.conversaciones.update(
      { id },
      {
        estado: EstadoConversacion.CERRADA,
        cerradaAt: new Date(),
        cerradaPorId: operador.id,
        motivoCierre: MotivoCierre.ATENDIDA,
        noLeidos: 0,
        esperandoOpcionMenu: false,
      },
    );
    return this.publicar(id);
  }

  async vincularCliente(id: string, clienteId: string | null): Promise<ConversacionDto> {
    const conv = await this.cargar(id);
    await this.contactos.vincularCliente(conv.contactoId, clienteId);
    return this.publicar(id);
  }

  async adjunto(mensajeId: string): Promise<{ datos: Buffer; mimeType: string; nombre: string }> {
    const m = await this.mensajesRepo.findOne({ where: { id: mensajeId } });
    if (!m?.adjuntoId) throw new NotFoundException('Adjunto no encontrado.');
    const a = await this.mensajes.leerAdjunto(m.adjuntoId);
    if (!a) throw new NotFoundException('Adjunto no encontrado.');
    return { datos: a.datos, mimeType: a.mimeType, nombre: m.nombreArchivo ?? `adjunto-${m.id}` };
  }

  // ─── internos ──────────────────────────────────────────────────

  /** Escribir en una charla la toma; en una cerrada, la reabre. */
  private async tomarAlEscribir(id: string, operador: Operador): Promise<WhatsappConversacion> {
    const conv = await this.cargar(id);
    const cambios: Partial<WhatsappConversacion> = { avisoInactividadAt: null };
    if (conv.estado !== EstadoConversacion.ATENDIDA || conv.atendidaPorId !== operador.id) {
      cambios.estado = EstadoConversacion.ATENDIDA;
      cambios.atendidaPorId = operador.id;
    }
    if (conv.estado === EstadoConversacion.CERRADA) {
      cambios.cerradaAt = null;
      cambios.cerradaPorId = null;
      cambios.motivoCierre = null;
    }
    await this.conversaciones.update({ id }, cambios);
    return this.cargar(id);
  }

  private async marcarLeida(conv: WhatsappConversacion): Promise<void> {
    if (conv.noLeidos > 0) await this.conversaciones.update({ id: conv.id }, { noLeidos: 0 });
    // createdAt va en el select porque ordena: con take, TypeORM arma una
    // consulta en dos fases y sólo puede ordenar por columnas seleccionadas.
    const pendientes = await this.mensajesRepo.find({
      where: { conversacionId: conv.id, direccion: DireccionMensaje.ENTRANTE, leidoAvisado: false },
      select: { id: true, waMessageId: true, createdAt: true },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    if (pendientes.length === 0) {
      if (conv.noLeidos > 0) await this.publicar(conv.id);
      return;
    }
    await this.mensajesRepo.update({ id: In(pendientes.map((m) => m.id)) }, { leidoAvisado: true });
    const ids = pendientes.map((m) => m.waMessageId).filter((x): x is string => !!x);
    void this.sidecar.marcarLeidos(conv.contacto.chatJid, ids);
    await this.publicar(conv.id);
  }

  private async cargar(id: string): Promise<WhatsappConversacion> {
    const conv = await this.conversaciones.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Charla no encontrada.');
    return conv;
  }

  private async publicar(id: string): Promise<ConversacionDto> {
    const dto = (await this.aDtos([await this.cargar(id)]))[0];
    this.eventos.publicar('conversacion', dto);
    return dto;
  }

  private async aDtos(filas: WhatsappConversacion[]): Promise<ConversacionDto[]> {
    if (filas.length === 0) return [];
    const clientes = await this.contactos.clientesDe(filas.map((c) => c.contacto));
    // distinctOn no entrecomilla: sin las comillas Postgres baja el nombre a
    // minúsculas y no encuentra la columna camelCase.
    const ultimos = await this.mensajesRepo
      .createQueryBuilder('m')
      .distinctOn(['"m"."conversacionId"'])
      .where('m.conversacionId IN (:...ids)', { ids: filas.map((c) => c.id) })
      .orderBy('"m"."conversacionId"')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    const ultimoPor = new Map(ultimos.map((m) => [m.conversacionId, m]));
    return filas.map((c) =>
      aConversacionDto(c, clientes.get(c.contacto.clienteId ?? '') ?? null, ultimoPor.get(c.id) ?? null),
    );
  }
}
