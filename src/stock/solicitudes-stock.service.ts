import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoSolicitudStock,
  OrigenSolicitudStock,
  SolicitudStock,
  SolicitudStockItem,
} from './entities/SolicitudStock.entity';
import stockConfig from '../config/stock.config';
import { ProductoStock } from './entities/ProductoStock.entity';
import { Personal } from '../personal/entities/Personal.entity';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { NotificacionesService } from '../whatsapp/notificaciones.service';
import { TipoNotificacion } from '../whatsapp/whatsapp.enums';
import { TZ_EMPRESA } from '../ritmo/turnos/fechas';
import { PushService } from '../push/push.service';
import { AccesosEmpleadoService } from './accesos-empleado.service';
import {
  CrearSolicitudStockDto,
  FiltroSolicitudesStockDto,
} from './dto/stock.dto';

export interface SolicitudStockDto {
  id: string;
  estado: EstadoSolicitudStock;
  origen: OrigenSolicitudStock;
  trabajador: { id: string; nombre: string };
  nota: string | null;
  respuesta: string | null;
  /** Quién la resolvió: alguien del panel, "Charly (WhatsApp)" o "Automática". */
  resueltaPor: string | null;
  resueltaAt: string | null;
  createdAt: string;
  items: {
    productoId: string | null;
    nombre: string;
    cantidad: number;
    /** Lo escribió ella: no estaba en el catálogo. */
    libre: boolean;
  }[];
}

/** Desde qué estados se puede confirmar o anular (no si ella la canceló). */
const RESOLUBLES = [
  EstadoSolicitudStock.PENDIENTE,
  EstadoSolicitudStock.APROBADA,
  EstadoSolicitudStock.RECHAZADA,
];

const ENLACE_EQUIPO = '/control-stock?tab=solicitudes';
const ENLACE_EMPLEADO = '/mis-productos';

/**
 * Pedidos de productos de los empleados. El empleado carga, admin o encargada
 * aprueban o rechazan, y el empleado puede cancelar mientras siga pendiente.
 * Cada paso avisa en vivo (SSE) y por push a quien corresponde.
 */
@Injectable()
export class SolicitudesStockService {
  private readonly logger = new Logger(SolicitudesStockService.name);

  constructor(
    @InjectRepository(SolicitudStock)
    private readonly repo: Repository<SolicitudStock>,
    @InjectRepository(ProductoStock)
    private readonly productoRepo: Repository<ProductoStock>,
    @InjectRepository(Personal)
    private readonly personalRepo: Repository<Personal>,
    private readonly accesos: AccesosEmpleadoService,
    private readonly notificaciones: NotificacionesService,
    private readonly push: PushService,
    @Inject(stockConfig.KEY)
    private readonly cfg: ConfigType<typeof stockConfig>,
  ) {}

  // ─── Empleado ────────────────────────────────────────────────

  /**
   * Lo que puede pedir: los productos que tiene asignados. Si todavía no le
   * asignaron ninguno, todos (para no dejarlo sin poder pedir).
   */
  async misProductos(
    personalId: string,
  ): Promise<{ id: string; nombre: string }[]> {
    const trabajadorId = await this.accesos.trabajadorDe(personalId);
    const asignados = await this.productoRepo
      .createQueryBuilder('p')
      .innerJoin('p.trabajadores', 't', 't.id = :trabajadorId', {
        trabajadorId,
      })
      .select(['p.id', 'p.nombre'])
      .orderBy('p.nombre', 'ASC')
      .getMany();
    if (asignados.length)
      return asignados.map((p) => ({ id: p.id, nombre: p.nombre }));
    const todos = await this.productoRepo.find({
      select: { id: true, nombre: true },
      order: { nombre: 'ASC' },
    });
    return todos.map((p) => ({ id: p.id, nombre: p.nombre }));
  }

  async misSolicitudes(personalId: string): Promise<SolicitudStockDto[]> {
    const trabajadorId = await this.accesos.trabajadorDe(personalId);
    const filas = await this.consulta()
      .where('s.trabajadorId = :trabajadorId', { trabajadorId })
      .take(100)
      .getMany();
    return filas.map((s) => this.aDto(s));
  }

  async crear(
    personalId: string,
    dto: CrearSolicitudStockDto,
  ): Promise<SolicitudStockDto> {
    const trabajadorId = await this.accesos.trabajadorDe(personalId);
    const permitidos = new Map(
      (await this.misProductos(personalId)).map((p) => [p.id, p.nombre]),
    );

    // Mismo producto dos veces = se suman.
    const cantidades = new Map<string, number>();
    for (const it of dto.items) {
      if (!permitidos.has(it.productoId)) {
        throw new BadRequestException(
          'Alguno de los productos no está disponible para vos',
        );
      }
      cantidades.set(
        it.productoId,
        Math.min(99, (cantidades.get(it.productoId) ?? 0) + (it.cantidad ?? 1)),
      );
    }

    const guardada = await this.repo.save(
      this.repo.create({
        trabajadorId,
        solicitadaPorId: personalId,
        estado: EstadoSolicitudStock.PENDIENTE,
        nota: dto.nota?.trim() || null,
        items: [...cantidades].map(([productoId, cantidad]) =>
          Object.assign(new SolicitudStockItem(), {
            productoId,
            productoNombre: permitidos.get(productoId) as string,
            cantidad,
          }),
        ),
      }),
    );
    const solicitud = this.aDto(await this.obtener(guardada.id));
    await this.avisarAlEquipo(solicitud, 'pidió productos');
    return solicitud;
  }

  async cancelar(personalId: string, id: string): Promise<SolicitudStockDto> {
    const trabajadorId = await this.accesos.trabajadorDe(personalId);
    const s = await this.obtener(id);
    if (s.trabajadorId !== trabajadorId)
      throw new ForbiddenException('No es tu solicitud');
    await this.cambiarEstado(id, EstadoSolicitudStock.CANCELADA, {
      resueltaPorId: personalId,
    });
    return this.aDto(await this.obtener(id));
  }

  /** La cancela ella desde Ritmo: sólo las suyas y sólo pendientes. */
  async cancelarDesdeRitmo(
    trabajadorId: string,
    id: string,
  ): Promise<SolicitudStock> {
    const s = await this.obtener(id);
    if (s.trabajadorId !== trabajadorId)
      throw new ForbiddenException('Ese registro no es tuyo.');
    await this.cambiarEstado(id, EstadoSolicitudStock.CANCELADA, {
      resueltaPorNombre: s.trabajador?.nombre ?? 'Ella',
    });
    return this.obtener(id);
  }

  // ─── Equipo (admin / encargada) ──────────────────────────────

  async listar(
    filtro: FiltroSolicitudesStockDto,
  ): Promise<SolicitudStockDto[]> {
    const q = this.consulta();
    // Días en la hora del salón, inclusive.
    if (filtro.desde)
      q.andWhere(`(s.createdAt AT TIME ZONE :tz)::date >= :desde`, {
        tz: TZ_EMPRESA,
        desde: filtro.desde,
      });
    if (filtro.hasta)
      q.andWhere(`(s.createdAt AT TIME ZONE :tz)::date <= :hasta`, {
        tz: TZ_EMPRESA,
        hasta: filtro.hasta,
      });
    if (filtro.estado)
      q.andWhere('s.estado = :estado', { estado: filtro.estado });
    if (filtro.trabajadorId)
      q.andWhere('s.trabajadorId = :trabajadorId', {
        trabajadorId: filtro.trabajadorId,
      });
    const filas = await q.take(300).getMany();
    return filas.map((s) => this.aDto(s));
  }

  async contarPendientes(): Promise<number> {
    return this.repo.count({
      where: { estado: EstadoSolicitudStock.PENDIENTE },
    });
  }

  async resolver(
    personalId: string,
    id: string,
    estado: EstadoSolicitudStock.APROBADA | EstadoSolicitudStock.RECHAZADA,
    respuesta?: string,
  ): Promise<SolicitudStockDto> {
    await this.cambiarEstado(
      id,
      estado,
      { resueltaPorId: personalId, respuesta: respuesta?.trim() || null },
      RESOLUBLES,
    );
    const solicitud = this.aDto(await this.obtener(id));

    // Al empleado (si todavía tiene acceso).
    const acceso = await this.personalRepo.findOne({
      where: {
        trabajadorId: solicitud.trabajador.id,
        rol: RolPersonal.EMPLEADO,
        activo: true,
      },
      select: { id: true },
    });
    if (acceso) {
      const aprobada = estado === EstadoSolicitudStock.APROBADA;
      const titulo = aprobada
        ? 'Te aprobaron el pedido'
        : 'Te rechazaron el pedido';
      const cuerpo =
        this.resumenItems(solicitud) +
        (solicitud.respuesta ? ` · ${solicitud.respuesta}` : '');
      await this.avisar(
        () =>
          this.notificaciones.crear(
            TipoNotificacion.SOLICITUD_RESUELTA,
            titulo,
            cuerpo,
            null,
            {
              destinatarioId: acceso.id,
              enlace: ENLACE_EMPLEADO,
            },
          ),
        () =>
          this.push.enviarA([acceso.id], {
            titulo,
            cuerpo,
            enlace: ENLACE_EMPLEADO,
            tag: `solicitud-${id}`,
          }),
      );
    }
    return solicitud;
  }

  /**
   * Confirmar o anular desde la encuesta del grupo de WhatsApp. El último
   * voto gana; lo que ella canceló queda cancelado.
   */
  async resolverPorVoto(
    id: string,
    estado: EstadoSolicitudStock.APROBADA | EstadoSolicitudStock.RECHAZADA,
    quien: string,
  ): Promise<SolicitudStock> {
    await this.cambiarEstado(
      id,
      estado,
      { resueltaPorNombre: `${quien} (WhatsApp)`.slice(0, 80) },
      RESOLUBLES,
    );
    return this.obtener(id);
  }

  /**
   * Lo que nadie anuló en la hora (STOCK_AUTOCONFIRMA_MIN) se confirma solo:
   * casi todo se confirma y nadie tiene que estar tocando cada registro.
   */
  @Cron('* * * * *')
  async autoconfirmar(ahora = new Date()): Promise<number> {
    const limite = new Date(
      ahora.getTime() - this.cfg.autoconfirmaMin * 60_000,
    );
    const r = await this.repo
      .createQueryBuilder()
      .update(SolicitudStock)
      .set({
        estado: EstadoSolicitudStock.APROBADA,
        resueltaPorNombre: 'Automática',
        resueltaAt: ahora,
      })
      .where('estado = :pendiente AND "createdAt" <= :limite', {
        pendiente: EstadoSolicitudStock.PENDIENTE,
        limite,
      })
      .execute();
    if (r.affected)
      this.logger.log(
        `${r.affected} registro(s) de productos confirmados solos`,
      );
    return r.affected ?? 0;
  }

  // ─── Internos ────────────────────────────────────────────────

  /**
   * Cambia el estado si está en uno de `desde` (por defecto, sólo
   * PENDIENTE). Si no existe, 404; si ya no se puede, 409.
   */
  private async cambiarEstado(
    id: string,
    estado: EstadoSolicitudStock,
    extra: {
      resueltaPorId?: string | null;
      resueltaPorNombre?: string | null;
      respuesta?: string | null;
    },
    desde: EstadoSolicitudStock[] = [EstadoSolicitudStock.PENDIENTE],
  ): Promise<void> {
    const r = await this.repo
      .createQueryBuilder()
      .update(SolicitudStock)
      .set({
        estado,
        resueltaPorId: extra.resueltaPorId ?? null,
        resueltaPorNombre: extra.resueltaPorNombre ?? null,
        respuesta: extra.respuesta ?? null,
        resueltaAt: new Date(),
      })
      .where('id = :id AND estado IN (:...desde)', { id, desde })
      .execute();
    if (!r.affected) {
      const s = await this.repo.findOne({
        where: { id },
        select: { id: true, estado: true },
      });
      if (!s) throw new NotFoundException('Solicitud no encontrada');
      throw new ConflictException(
        s.estado === EstadoSolicitudStock.CANCELADA
          ? 'Ya la había cancelado ella'
          : 'La solicitud ya fue resuelta',
      );
    }
  }

  consulta() {
    return this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.items', 'i')
      .leftJoin('s.trabajador', 't')
      .addSelect(['t.id', 't.nombre'])
      .leftJoin('s.resueltaPor', 'r')
      .addSelect(['r.id', 'r.nombre'])
      .orderBy('s.createdAt', 'DESC')
      .addOrderBy('i.productoNombre', 'ASC');
  }

  async obtener(id: string): Promise<SolicitudStock> {
    const s = await this.consulta().where('s.id = :id', { id }).getOne();
    if (!s) throw new NotFoundException('Solicitud no encontrada');
    return s;
  }

  private resumenItems(s: SolicitudStockDto): string {
    return s.items
      .map((i) => (i.cantidad > 1 ? `${i.nombre} ×${i.cantidad}` : i.nombre))
      .join(', ');
  }

  /** Aviso en el panel (en vivo y push) de que alguien anotó o pidió productos. */
  async avisarAlEquipo(
    solicitud: SolicitudStockDto,
    verbo: string,
  ): Promise<void> {
    const titulo = `${solicitud.trabajador.nombre} ${verbo}`;
    const cuerpo =
      this.resumenItems(solicitud) +
      (solicitud.nota ? ` · ${solicitud.nota}` : '');
    await this.avisar(
      () =>
        this.notificaciones.crear(
          TipoNotificacion.SOLICITUD_STOCK,
          titulo,
          cuerpo,
          null,
          { enlace: ENLACE_EQUIPO },
        ),
      () =>
        this.push.enviarARoles([RolPersonal.ADMIN, RolPersonal.ENCARGADO], {
          titulo,
          cuerpo,
          enlace: ENLACE_EQUIPO,
          tag: `solicitud-${solicitud.id}`,
        }),
    );
  }

  /** Un aviso que falla no tiene que tirar abajo la solicitud ya guardada. */
  private async avisar(...envios: (() => Promise<unknown>)[]): Promise<void> {
    const r = await Promise.allSettled(envios.map((f) => f()));
    for (const x of r)
      if (x.status === 'rejected')
        this.logger.warn(`Aviso de stock falló: ${x.reason}`);
  }

  aDto(s: SolicitudStock): SolicitudStockDto {
    const iso = (d: Date | null | undefined) =>
      d ? (d instanceof Date ? d.toISOString() : String(d)) : null;
    return {
      id: s.id,
      estado: s.estado,
      origen: s.origen,
      trabajador: {
        id: s.trabajador?.id ?? s.trabajadorId,
        nombre: s.trabajador?.nombre ?? '',
      },
      nota: s.nota,
      respuesta: s.respuesta,
      resueltaPor: s.resueltaPor?.nombre ?? s.resueltaPorNombre ?? null,
      resueltaAt: iso(s.resueltaAt),
      createdAt: iso(s.createdAt) as string,
      items: (s.items ?? []).map((i) => ({
        productoId: i.productoId,
        nombre: i.productoNombre,
        cantidad: i.cantidad,
        libre: i.libre,
      })),
    };
  }
}
