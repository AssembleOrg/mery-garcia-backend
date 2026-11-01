import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import stockConfig from '../config/stock.config';
import { Trabajador } from '../personal/entities/Trabajador.entity';
import { TZ_EMPRESA } from '../ritmo/turnos/fechas';
import { validarDia } from '../ritmo/servicios/resumen';
import { ProductoStock } from './entities/ProductoStock.entity';
import {
  EstadoSolicitudStock,
  OrigenSolicitudStock,
  SolicitudStock,
  SolicitudStockItem,
} from './entities/SolicitudStock.entity';
import {
  ESTADO_RITMO,
  MAX_RESULTADOS,
  buscarEnCatalogo,
  etiquetaEstado,
  tituloEncuesta,
  type EstadoRitmo,
  type PedidoRitmo,
} from './registro-productos';
import { SolicitudesStockService } from './solicitudes-stock.service';
import { AvisoWhatsappStockService } from './aviso-whatsapp-stock.service';

/** Un registro tal como lo muestra Ritmo (contrato `records[]`). */
export interface RegistroParaRitmo {
  id: string;
  createdAt: string;
  items: { name: string; quantity: number; freeText: boolean }[];
  note: string | null;
  status: EstadoRitmo;
  statusLabel: string;
  canCancel: boolean;
}

export type LecturaParaRitmo =
  | { enabled: false }
  | {
      enabled: true;
      allowFreeText: true;
      products: { id: string; name: string }[];
      records: RegistroParaRitmo[];
    };

/**
 * Lo que Ritmo le pregunta a este sistema sobre los productos que anota
 * cada chica: qué hay en el catálogo, qué anotó hoy, anotar y cancelar.
 * Sólo para trabajadoras vinculadas a Ritmo y con `ritmoRegistraProductos`.
 */
@Injectable()
export class RegistroRitmoService {
  private readonly logger = new Logger(RegistroRitmoService.name);

  constructor(
    @InjectRepository(Trabajador)
    private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(ProductoStock)
    private readonly productos: Repository<ProductoStock>,
    @InjectRepository(SolicitudStock)
    private readonly solicitudesRepo: Repository<SolicitudStock>,
    private readonly solicitudes: SolicitudesStockService,
    private readonly aviso: AvisoWhatsappStockService,
    @Inject(stockConfig.KEY)
    private readonly cfg: ConfigType<typeof stockConfig>,
  ) {}

  async leer(
    ritmoUserId: string,
    dia: string,
    q: string,
  ): Promise<LecturaParaRitmo> {
    const day = validarDia(dia);
    const t = await this.habilitada(ritmoUserId);
    if (!t) return { enabled: false };
    const [products, records] = await Promise.all([
      q.trim() ? this.buscar(q) : this.sugeridos(t.id),
      this.delDia(t.id, day),
    ]);
    return { enabled: true, allowFreeText: true, products, records };
  }

  async ejecutar(pedido: PedidoRitmo): Promise<{ record: RegistroParaRitmo }> {
    const t = await this.habilitada(pedido.userId);
    if (!t)
      throw new BadRequestException(
        'No tenés habilitado anotar productos. Pedíselo a recepción.',
      );
    if (pedido.accion === 'cancelar') {
      const s = await this.solicitudes.cancelarDesdeRitmo(
        t.id,
        pedido.registroId,
      );
      return { record: this.aRitmo(s) };
    }

    // Lo que vino con id del catálogo se guarda con el nombre del catálogo;
    // un id que ya no existe (lo borraron) queda como texto libre.
    const ids = pedido.items.flatMap((i) =>
      i.productoId ? [i.productoId] : [],
    );
    const catalogo = new Map(
      ids.length
        ? (await this.productos.find({ where: { id: In(ids) } })).map((p) => [
            p.id,
            p.nombre,
          ])
        : [],
    );
    const guardada = await this.solicitudesRepo.save(
      this.solicitudesRepo.create({
        trabajadorId: t.id,
        solicitadaPorId: null,
        origen: OrigenSolicitudStock.RITMO,
        ritmoUserId: pedido.userId,
        estado: EstadoSolicitudStock.PENDIENTE,
        nota: pedido.nota,
        items: pedido.items.map((i) => {
          const delCatalogo = i.productoId
            ? catalogo.get(i.productoId)
            : undefined;
          return Object.assign(new SolicitudStockItem(), {
            productoId: delCatalogo ? i.productoId : null,
            productoNombre: (delCatalogo ?? i.nombre).slice(0, 150),
            cantidad: i.cantidad,
            libre: !delCatalogo,
          });
        }),
      }),
    );
    const s = await this.solicitudes.obtener(guardada.id);
    this.logger.log(
      `${t.nombre} anotó desde Ritmo: ${s.items.map((i) => `${i.cantidad} ${i.productoNombre}`).join(', ')}`,
    );

    // Avisos sin hacer esperar a Ritmo: el registro ya está guardado.
    void this.avisar(s, t.nombre);
    return { record: this.aRitmo(s) };
  }

  // ─── Internas ────────────────────────────────────────────────

  private async habilitada(ritmoUserId: string): Promise<Trabajador | null> {
    const t = await this.trabajadores.findOne({ where: { ritmoUserId } });
    return t && t.activo && t.ritmoRegistraProductos ? t : null;
  }

  private async buscar(q: string): Promise<{ id: string; name: string }[]> {
    const todos = await this.productos.find({
      select: { id: true, nombre: true },
    });
    return buscarEnCatalogo(todos, q).map((p) => ({
      id: p.id,
      name: p.nombre,
    }));
  }

  /** Sin búsqueda: lo que tiene asignado y lo que más anotó, hasta 20. */
  private async sugeridos(
    trabajadorId: string,
  ): Promise<{ id: string; name: string }[]> {
    const [asignados, usados] = await Promise.all([
      this.productos
        .createQueryBuilder('p')
        .innerJoin('p.trabajadores', 't', 't.id = :trabajadorId', {
          trabajadorId,
        })
        .select(['p.id', 'p.nombre'])
        .orderBy('p.nombre', 'ASC')
        .getMany(),
      this.solicitudesRepo.manager.query<{ id: string; nombre: string }[]>(
        `SELECT p.id, p.nombre
           FROM solicitudes_stock_items i
           JOIN solicitudes_stock s ON s.id = i."solicitudId"
           JOIN productos_stock p   ON p.id = i."productoId"
          WHERE s."trabajadorId" = $1 AND s.estado <> 'CANCELADA'
          GROUP BY p.id, p.nombre
          ORDER BY SUM(i.cantidad) DESC, p.nombre
          LIMIT $2`,
        [trabajadorId, MAX_RESULTADOS],
      ),
    ]);
    const vistos = new Set<string>();
    return [...usados, ...asignados]
      .filter((p) => !vistos.has(p.id) && vistos.add(p.id))
      .slice(0, MAX_RESULTADOS)
      .map((p) => ({ id: p.id, name: p.nombre }));
  }

  private async delDia(
    trabajadorId: string,
    dia: string,
  ): Promise<RegistroParaRitmo[]> {
    const filas = await this.solicitudes
      .consulta()
      .where('s.trabajadorId = :trabajadorId', { trabajadorId })
      .andWhere('(s.createdAt AT TIME ZONE :tz)::date = :dia', {
        tz: TZ_EMPRESA,
        dia,
      })
      .getMany();
    return filas.map((s) => this.aRitmo(s));
  }

  private aRitmo(s: SolicitudStock): RegistroParaRitmo {
    const creada =
      s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
    return {
      id: s.id,
      createdAt: creada.toISOString(),
      items: (s.items ?? []).map((i) => ({
        name: i.productoNombre,
        quantity: i.cantidad,
        freeText: i.libre,
      })),
      note: s.nota,
      status: ESTADO_RITMO[s.estado],
      statusLabel: etiquetaEstado(s.estado, creada, this.cfg.autoconfirmaMin),
      canCancel: s.estado === EstadoSolicitudStock.PENDIENTE,
    };
  }

  private async avisar(s: SolicitudStock, nombre: string): Promise<void> {
    try {
      await this.solicitudes.avisarAlEquipo(
        this.solicitudes.aDto(s),
        'anotó productos',
      );
      const mensajeId = await this.aviso.encuesta(
        s.id,
        tituloEncuesta({
          nombre,
          items: s.items.map((i) => ({
            nombre: i.productoNombre,
            cantidad: i.cantidad,
            libre: i.libre,
          })),
          nota: s.nota,
          creada: s.createdAt,
        }),
      );
      if (mensajeId)
        await this.solicitudesRepo.update(s.id, {
          whatsappMensajeId: mensajeId,
        });
    } catch (e) {
      this.logger.error(`Aviso del registro ${s.id}: ${(e as Error).message}`);
    }
  }
}
