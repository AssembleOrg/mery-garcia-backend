import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoSolicitudStock,
  SolicitudStock,
  SolicitudStockItem,
} from './entities/SolicitudStock.entity';
import { ProductoStock } from './entities/ProductoStock.entity';
import { Personal } from '../personal/entities/Personal.entity';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { NotificacionesService } from '../whatsapp/notificaciones.service';
import { TipoNotificacion } from '../whatsapp/whatsapp.enums';
import { PushService } from '../push/push.service';
import { AccesosEmpleadoService } from './accesos-empleado.service';
import {
  CrearSolicitudStockDto,
  FiltroSolicitudesStockDto,
} from './dto/stock.dto';

export interface SolicitudStockDto {
  id: string;
  estado: EstadoSolicitudStock;
  trabajador: { id: string; nombre: string };
  nota: string | null;
  respuesta: string | null;
  resueltaPor: string | null;
  resueltaAt: string | null;
  createdAt: string;
  items: { productoId: string | null; nombre: string; cantidad: number }[];
}

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

    const titulo = `${solicitud.trabajador.nombre} pidió productos`;
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

  // ─── Equipo (admin / encargada) ──────────────────────────────

  async listar(
    filtro: FiltroSolicitudesStockDto,
  ): Promise<SolicitudStockDto[]> {
    const q = this.consulta();
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
    await this.cambiarEstado(id, estado, {
      resueltaPorId: personalId,
      respuesta: respuesta?.trim() || null,
    });
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

  // ─── Internos ────────────────────────────────────────────────

  /** Sólo pasa de PENDIENTE a otro estado; si alguien ya la resolvió, 409. */
  private async cambiarEstado(
    id: string,
    estado: EstadoSolicitudStock,
    extra: { resueltaPorId: string; respuesta?: string | null },
  ): Promise<void> {
    const r = await this.repo
      .createQueryBuilder()
      .update(SolicitudStock)
      .set({
        estado,
        resueltaPorId: extra.resueltaPorId,
        respuesta: extra.respuesta ?? null,
        resueltaAt: new Date(),
      })
      .where('id = :id AND estado = :pendiente', {
        id,
        pendiente: EstadoSolicitudStock.PENDIENTE,
      })
      .execute();
    if (!r.affected) {
      const existe = await this.repo.exists({ where: { id } });
      if (!existe) throw new NotFoundException('Solicitud no encontrada');
      throw new ConflictException('La solicitud ya fue resuelta');
    }
  }

  private consulta() {
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

  private async obtener(id: string): Promise<SolicitudStock> {
    const s = await this.consulta().where('s.id = :id', { id }).getOne();
    if (!s) throw new NotFoundException('Solicitud no encontrada');
    return s;
  }

  private resumenItems(s: SolicitudStockDto): string {
    return s.items
      .map((i) => (i.cantidad > 1 ? `${i.nombre} ×${i.cantidad}` : i.nombre))
      .join(', ');
  }

  /** Un aviso que falla no tiene que tirar abajo la solicitud ya guardada. */
  private async avisar(...envios: (() => Promise<unknown>)[]): Promise<void> {
    const r = await Promise.allSettled(envios.map((f) => f()));
    for (const x of r)
      if (x.status === 'rejected')
        this.logger.warn(`Aviso de stock falló: ${x.reason}`);
  }

  private aDto(s: SolicitudStock): SolicitudStockDto {
    const iso = (d: Date | null | undefined) =>
      d ? (d instanceof Date ? d.toISOString() : String(d)) : null;
    return {
      id: s.id,
      estado: s.estado,
      trabajador: {
        id: s.trabajador?.id ?? s.trabajadorId,
        nombre: s.trabajador?.nombre ?? '',
      },
      nota: s.nota,
      respuesta: s.respuesta,
      resueltaPor: s.resueltaPor?.nombre ?? null,
      resueltaAt: iso(s.resueltaAt),
      createdAt: iso(s.createdAt) as string,
      items: (s.items ?? []).map((i) => ({
        productoId: i.productoId,
        nombre: i.productoNombre,
        cantidad: i.cantidad,
      })),
    };
  }
}
