import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  ComprobanteCompra,
  EstadoPedidoCompra as E,
  MonedaCompra,
  PedidoCompra,
  PedidoCompraItem,
} from './entities/PedidoCompra.entity';
import { ProveedorCompra } from './entities/ProveedorCompra.entity';
import { CategoriaCompra } from './entities/CategoriaCompra.entity';
import { ProductoStock } from '../stock/entities/ProductoStock.entity';
import {
  EntregarPedidoDto,
  FiltroPedidosCompraDto,
  GuardarPedidoCompraDto,
} from './dto/compras.dto';
import {
  MENSAJE_BLOQUEADO,
  bloqueado,
  claveNombre,
  editableHasta,
  faltaPara,
  fechasPara,
  limpiarNombre,
  totalCalculado,
} from './reglas';
import { CostearComprobantesService } from './costear-comprobantes.service';
import { TZ_EMPRESA } from '../ritmo/turnos/fechas';

export interface UsuarioCompras {
  id: string | null;
  nombre: string;
}

const MIME_COMPROBANTE =
  /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
export const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024;
const MAX_COMPROBANTES_POR_PEDIDO = 10;
const ABIERTOS = [E.ANOTADO, E.PEDIR_PRECIO, E.COMPRADO];

export interface PedidoCompraVista {
  id: string;
  numero: number;
  titulo: string | null;
  nota: string | null;
  estado: E;
  moneda: MonedaCompra;
  /** Total a mano (si lo cargaron). */
  total: number | null;
  /** Suma de cantidad × precio de los renglones con precio. */
  totalCalculado: number | null;
  medioPago: string | null;
  compradoAt: Date | null;
  entregadoAt: Date | null;
  /** Null = todavía no se compró: se edita sin límite. */
  editableHasta: Date | null;
  bloqueado: boolean;
  creadoPorNombre: string;
  actualizadoPorNombre: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  proveedores: { id: string; nombre: string; dadoDeBaja: boolean }[];
  items: {
    id: string;
    productoId: string | null;
    nombre: string;
    cantidad: number;
    cantidadRecibida: number | null;
    precioUnitario: number | null;
    afectaStock: boolean;
    categorias: { id: string; nombre: string }[];
  }[];
  comprobantes: {
    id: string;
    nombre: string;
    mimeType: string;
    tamanio: number;
    subidoPorNombre: string | null;
    createdAt: Date;
    costearEstado: string | null;
    costearDetalle: string | null;
    costearEnviadoAt: Date | null;
  }[];
}

@Injectable()
export class ComprasService {
  constructor(
    @InjectRepository(PedidoCompra)
    private readonly pedidos: Repository<PedidoCompra>,
    @InjectRepository(ComprobanteCompra)
    private readonly comprobantes: Repository<ComprobanteCompra>,
    private readonly ds: DataSource,
    private readonly costear: CostearComprobantesService,
  ) {}

  // ─── Lectura ─────────────────────────────────────────────────

  async listar(f: FiltroPedidosCompraDto): Promise<{
    items: PedidoCompraVista[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = f.page ?? 1;
    const limit = f.limit ?? 30;
    const q = this.pedidos
      .createQueryBuilder('p')
      .select(['p.id', 'p.createdAt'])
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (f.estado === 'ABIERTOS')
      q.andWhere('p.estado IN (:...abiertos)', { abiertos: ABIERTOS });
    else if (f.estado) q.andWhere('p.estado = :estado', { estado: f.estado });

    const buscar = f.buscar?.trim();
    if (buscar) {
      const b = `%${buscar.replace(/[\\%_]/g, '\\$&')}%`;
      const numero = /^#?\d{1,9}$/.test(buscar)
        ? Number(buscar.replace('#', ''))
        : null;
      q.andWhere(
        new Brackets((w) => {
          w.where('p.titulo ILIKE :b', { b })
            .orWhere('p.nota ILIKE :b', { b })
            .orWhere(
              `EXISTS (SELECT 1 FROM compras_pedidos_items bi
                        WHERE bi."pedidoId" = p.id AND bi.nombre ILIKE :b)`,
              { b },
            )
            .orWhere(
              `EXISTS (SELECT 1 FROM compras_pedidos_proveedores bpp
                         JOIN compras_proveedores bpr ON bpr.id = bpp."proveedorId"
                        WHERE bpp."pedidoId" = p.id AND bpr.nombre ILIKE :b)`,
              { b },
            );
          if (numero !== null) w.orWhere('p.numero = :numero', { numero });
        }),
      );
    }
    if (f.categoriaId)
      q.andWhere(
        `EXISTS (SELECT 1 FROM compras_pedidos_items ci
                   JOIN compras_items_categorias cic ON cic."itemId" = ci.id
                  WHERE ci."pedidoId" = p.id AND cic."categoriaId" = :categoriaId)`,
        { categoriaId: f.categoriaId },
      );
    if (f.proveedorId)
      q.andWhere(
        `EXISTS (SELECT 1 FROM compras_pedidos_proveedores fpp
                  WHERE fpp."pedidoId" = p.id AND fpp."proveedorId" = :proveedorId)`,
        { proveedorId: f.proveedorId },
      );
    // Días en la hora del salón, inclusive.
    if (f.desde)
      q.andWhere(`(p.createdAt AT TIME ZONE :tz)::date >= :desde`, {
        tz: TZ_EMPRESA,
        desde: f.desde,
      });
    if (f.hasta)
      q.andWhere(`(p.createdAt AT TIME ZONE :tz)::date <= :hasta`, {
        tz: TZ_EMPRESA,
        hasta: f.hasta,
      });

    const [filas, total] = await q.getManyAndCount();
    const completos = await this.cargar(filas.map((x) => x.id));
    const ahora = new Date();
    return {
      items: filas
        .map((x) => completos.get(x.id))
        .filter((p): p is PedidoCompra => !!p)
        .map((p) => vista(p, ahora)),
      total,
      page,
      limit,
    };
  }

  /** Cuántos hay en cada estado (para las pestañas). */
  async contarPorEstado(): Promise<Record<E, number>> {
    const filas = await this.pedidos
      .createQueryBuilder('p')
      .select('p.estado', 'estado')
      .addSelect('COUNT(*)::int', 'n')
      .groupBy('p.estado')
      .getRawMany<{ estado: E; n: number }>();
    const base = Object.fromEntries(
      Object.values(E).map((e) => [e, 0]),
    ) as Record<E, number>;
    for (const f of filas) base[f.estado] = Number(f.n);
    return base;
  }

  async obtener(id: string): Promise<PedidoCompraVista> {
    const p = (await this.cargar([id])).get(id);
    if (!p) throw new NotFoundException('Pedido no encontrado');
    return vista(p);
  }

  // ─── Alta / edición ──────────────────────────────────────────

  async crear(
    dto: GuardarPedidoCompraDto,
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    const id = await this.ds.transaction(async (m) => {
      const p = m.create(PedidoCompra, {
        estado: E.ANOTADO,
        moneda: MonedaCompra.ARS,
        compradoAt: null,
        entregadoAt: null,
        creadoPorId: u.id,
        creadoPorNombre: u.nombre,
      });
      return this.guardar(m, p, [], dto, u);
    });
    return this.obtener(id);
  }

  async actualizar(
    id: string,
    dto: GuardarPedidoCompraDto,
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    await this.ds.transaction(async (m) => {
      const p = await this.bloquearFila(m, id);
      if (bloqueado(p.compradoAt))
        throw new ConflictException(MENSAJE_BLOQUEADO);
      if (dto.version !== undefined && dto.version !== p.version)
        throw new ConflictException(
          'Alguien cambió este pedido mientras lo editabas. Volvé a abrirlo.',
        );
      const previos = await m
        .createQueryBuilder()
        .select('pp."proveedorId"', 'id')
        .from('compras_pedidos_proveedores', 'pp')
        .where('pp."pedidoId" = :id', { id })
        .getRawMany<{ id: string }>();
      await this.guardar(
        m,
        p,
        previos.map((x) => x.id),
        dto,
        u,
      );
    });
    return this.obtener(id);
  }

  async cambiarEstado(
    id: string,
    estado: E,
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    if (estado === E.ENTREGADO) return this.entregar(id, {}, u);
    await this.ds.transaction(async (m) => {
      const p = await this.bloquearFila(m, id);
      if (bloqueado(p.compradoAt))
        throw new ConflictException(MENSAJE_BLOQUEADO);
      const [items, proveedores] = await Promise.all([
        m.count(PedidoCompraItem, { where: { pedidoId: id } }),
        m
          .createQueryBuilder()
          .from('compras_pedidos_proveedores', 'pp')
          .where('pp."pedidoId" = :id', { id })
          .getCount(),
      ]);
      const falta = faltaPara(estado, {
        titulo: p.titulo,
        nota: p.nota,
        items,
        proveedores,
      });
      if (falta) throw new BadRequestException(falta);
      const fechas = fechasPara(estado, p);
      await m.update(PedidoCompra, id, {
        estado,
        ...fechas,
        actualizadoPorNombre: u.nombre,
      });
    });
    return this.obtener(id);
  }

  /**
   * Llegó: desde acá los renglones que afectan stock suman. Se puede marcar
   * aunque hayan pasado las 48 h (la entrega suele llegar después).
   */
  async entregar(
    id: string,
    dto: EntregarPedidoDto,
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    await this.ds.transaction(async (m) => {
      const p = await this.bloquearFila(m, id);
      const pasado = bloqueado(p.compradoAt);
      // Pasadas las 48 h sólo queda marcar que llegó lo que estaba comprado.
      if (pasado && p.estado !== E.COMPRADO)
        throw new ConflictException(MENSAJE_BLOQUEADO);
      const items = await m.find(PedidoCompraItem, { where: { pedidoId: id } });
      const proveedores = await m
        .createQueryBuilder()
        .from('compras_pedidos_proveedores', 'pp')
        .where('pp."pedidoId" = :id', { id })
        .getCount();
      const falta = faltaPara(E.ENTREGADO, {
        titulo: p.titulo,
        nota: p.nota,
        items: items.length,
        proveedores,
      });
      if (falta) throw new BadRequestException(falta);

      const recibidos = new Map(
        (dto.recibidos ?? []).map((r) => [r.itemId, r.cantidadRecibida]),
      );
      for (const itemId of recibidos.keys())
        if (!items.some((i) => i.id === itemId))
          throw new BadRequestException('Ese renglón no es de este pedido.');
      for (const i of items) {
        const r = recibidos.get(i.id);
        // Null = llegó todo lo pedido.
        const cantidadRecibida = r === undefined || r === i.cantidad ? null : r;
        if (cantidadRecibida !== i.cantidadRecibida)
          await m.update(PedidoCompraItem, i.id, { cantidadRecibida });
      }
      await m.update(PedidoCompra, id, {
        estado: E.ENTREGADO,
        ...fechasPara(E.ENTREGADO, p),
        actualizadoPorNombre: u.nombre,
      });
    });
    return this.obtener(id);
  }

  async eliminar(id: string): Promise<void> {
    await this.ds.transaction(async (m) => {
      const p = await this.bloquearFila(m, id);
      if (bloqueado(p.compradoAt))
        throw new ConflictException(MENSAJE_BLOQUEADO);
      await m.softDelete(PedidoCompra, id);
    });
  }

  /** Copia artículos, cantidades, categorías y proveedores en un pedido nuevo (sin precios). */
  async repetir(id: string, u: UsuarioCompras): Promise<PedidoCompraVista> {
    const origen = (await this.cargar([id])).get(id);
    if (!origen) throw new NotFoundException('Pedido no encontrado');
    const nuevoId = await this.ds.transaction(async (m) => {
      const p = await m.save(
        m.create(PedidoCompra, {
          titulo: origen.titulo,
          nota: `Repetido del pedido N° ${origen.numero}.`,
          estado: E.ANOTADO,
          moneda: origen.moneda,
          creadoPorId: u.id,
          creadoPorNombre: u.nombre,
          proveedores: origen.proveedores.filter((x) => !x.deletedAt),
        }),
      );
      await m.save(
        ordenar(origen.items).map((i, n) =>
          m.create(PedidoCompraItem, {
            pedidoId: p.id,
            orden: n,
            productoId: i.productoId,
            nombre: i.nombre,
            cantidad: i.cantidad,
            afectaStock: i.afectaStock,
            categorias: i.categorias,
          }),
        ),
      );
      return p.id;
    });
    return this.obtener(nuevoId);
  }

  // ─── Comprobantes ────────────────────────────────────────────

  async agregarComprobantes(
    id: string,
    archivos: Express.Multer.File[],
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    if (!archivos?.length) throw new BadRequestException('Falta el archivo.');
    for (const a of archivos) {
      if (!MIME_COMPROBANTE.test(a.mimetype))
        throw new BadRequestException(
          `"${nombreArchivo(a.originalname)}": sólo imágenes o PDF.`,
        );
      if (a.size > MAX_COMPROBANTE_BYTES)
        throw new BadRequestException(
          `"${nombreArchivo(a.originalname)}" pesa más de 10 MB.`,
        );
    }
    // Adjuntar se puede siempre (la factura suele llegar con la entrega,
    // después de las 48 h); lo que se cierra a las 48 h es borrar.
    const nuevos = await this.ds.transaction(async (m) => {
      await this.bloquearFila(m, id);
      const existentes = await m.count(ComprobanteCompra, {
        where: { pedidoId: id },
      });
      if (existentes + archivos.length > MAX_COMPROBANTES_POR_PEDIDO)
        throw new BadRequestException(
          `Máximo ${MAX_COMPROBANTES_POR_PEDIDO} comprobantes por pedido.`,
        );
      const guardados = await m.save(
        archivos.map((a) =>
          m.create(ComprobanteCompra, {
            pedidoId: id,
            nombre: nombreArchivo(a.originalname),
            mimeType: a.mimetype,
            tamanio: a.size,
            datos: a.buffer,
            subidoPorNombre: u.nombre,
            costearEstado: this.costear.configurado ? 'PENDIENTE' : null,
          }),
        ),
      );
      await m.update(PedidoCompra, id, {
        actualizadoPorNombre: u.nombre,
      });
      return guardados.map((g) => g.id);
    });
    this.costear.enviarEnSegundoPlano(nuevos);
    return this.obtener(id);
  }

  async comprobante(cid: string): Promise<ComprobanteCompra> {
    const c = await this.comprobantes
      .createQueryBuilder('c')
      .addSelect('c.datos')
      .where('c.id = :cid', { cid })
      .getOne();
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    return c;
  }

  async eliminarComprobante(
    cid: string,
    u: UsuarioCompras,
  ): Promise<PedidoCompraVista> {
    const c = await this.comprobantes.findOne({ where: { id: cid } });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    await this.ds.transaction(async (m) => {
      const p = await this.bloquearFila(m, c.pedidoId);
      if (bloqueado(p.compradoAt))
        throw new ConflictException(MENSAJE_BLOQUEADO);
      await m.delete(ComprobanteCompra, cid);
      await m.update(PedidoCompra, p.id, {
        actualizadoPorNombre: u.nombre,
      });
    });
    return this.obtener(c.pedidoId);
  }

  /** Lo vuelve a mandar a Costear (o pregunta cómo quedó, si ya lo tiene). */
  async costearComprobante(
    cid: string,
    reenviar: boolean,
  ): Promise<PedidoCompraVista> {
    const c = reenviar
      ? await this.costear.enviar(cid)
      : await this.costear.actualizarEstado(cid);
    return this.obtener(c.pedidoId);
  }

  // ─── Internos ────────────────────────────────────────────────

  /** Toma la fila del pedido (uno a la vez) o 404. */
  private async bloquearFila(
    m: EntityManager,
    id: string,
  ): Promise<PedidoCompra> {
    const p = await m.findOne(PedidoCompra, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    return p;
  }

  /** Guarda cabecera, proveedores y renglones (los renglones se reemplazan). */
  private async guardar(
    m: EntityManager,
    p: PedidoCompra,
    proveedoresPrevios: string[],
    dto: GuardarPedidoCompraDto,
    u: UsuarioCompras,
  ): Promise<string> {
    const esNuevo = !p.id;
    const estado = dto.estado ?? p.estado;
    const titulo =
      dto.titulo === undefined ? p.titulo : dto.titulo?.trim() || null;
    const nota = dto.nota === undefined ? p.nota : dto.nota?.trim() || null;

    // Proveedores: los ya vinculados pueden estar dados de baja; los nuevos no.
    const proveedorIds = [...new Set(dto.proveedorIds)];
    const proveedores = proveedorIds.length
      ? await m.find(ProveedorCompra, {
          where: { id: In(proveedorIds) },
          withDeleted: true,
        })
      : [];
    if (proveedores.length !== proveedorIds.length)
      throw new NotFoundException('Alguno de los proveedores no existe.');
    const baja = proveedores.find(
      (x) => x.deletedAt && !proveedoresPrevios.includes(x.id),
    );
    if (baja)
      throw new BadRequestException(`"${baja.nombre}" está dado de baja.`);

    const categoriaIds = [
      ...new Set(dto.items.flatMap((i) => i.categoriaIds ?? [])),
    ];
    const categorias = categoriaIds.length
      ? await m.find(CategoriaCompra, { where: { id: In(categoriaIds) } })
      : [];
    if (categorias.length !== categoriaIds.length)
      throw new NotFoundException('Alguna de las categorías no existe.');
    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

    const productoIds = [
      ...new Set(
        dto.items.map((i) => i.productoId).filter((x): x is string => !!x),
      ),
    ];
    if (productoIds.length) {
      const existen = await m.count(ProductoStock, {
        where: { id: In(productoIds) },
      });
      if (existen !== productoIds.length)
        throw new NotFoundException(
          'Algún artículo del catálogo ya no existe.',
        );
    }

    const falta = faltaPara(estado, {
      titulo,
      nota,
      items: dto.items.length,
      proveedores: proveedores.length,
    });
    if (falta) throw new BadRequestException(falta);

    // Lo que afecta stock tiene que estar en el catálogo: se busca por nombre o se crea.
    const catalogo = new Map<string, string>();
    if (dto.items.some((i) => i.afectaStock && !i.productoId)) {
      const todos = await m.find(ProductoStock, {
        select: { id: true, nombre: true },
      });
      for (const x of todos)
        if (!catalogo.has(claveNombre(x.nombre)))
          catalogo.set(claveNombre(x.nombre), x.id);
    }
    const items: PedidoCompraItem[] = [];
    for (const [n, i] of dto.items.entries()) {
      const nombre = limpiarNombre(i.nombre);
      if (!nombre) throw new BadRequestException('Hay un artículo sin nombre.');
      let productoId = i.productoId ?? null;
      if (i.afectaStock && !productoId) {
        productoId = catalogo.get(claveNombre(nombre)) ?? null;
        if (!productoId) {
          const nuevo = await m.save(m.create(ProductoStock, { nombre }));
          productoId = nuevo.id;
          catalogo.set(claveNombre(nombre), productoId);
        }
      }
      items.push(
        m.create(PedidoCompraItem, {
          orden: n,
          productoId,
          nombre,
          cantidad: i.cantidad,
          // Lo recibido sólo tiene sentido si ya llegó.
          cantidadRecibida:
            estado === E.ENTREGADO &&
            i.cantidadRecibida != null &&
            i.cantidadRecibida !== i.cantidad
              ? i.cantidadRecibida
              : null,
          precioUnitario:
            i.precioUnitario == null ? null : String(i.precioUnitario),
          afectaStock: !!i.afectaStock,
          categorias: [...new Set(i.categoriaIds ?? [])].map(
            (c) => categoriaPorId.get(c)!,
          ),
        }),
      );
    }

    const fechas = fechasPara(estado, p);
    Object.assign(p, {
      titulo,
      nota,
      estado,
      moneda: dto.moneda ?? p.moneda,
      total:
        dto.total === undefined
          ? p.total
          : dto.total === null
            ? null
            : String(dto.total),
      medioPago:
        dto.medioPago === undefined
          ? p.medioPago
          : dto.medioPago?.trim() || null,
      ...fechas,
      proveedores,
      actualizadoPorNombre: esNuevo ? null : u.nombre,
    });
    delete (p as Partial<PedidoCompra>).items;
    const guardado = await m.save(PedidoCompra, p);

    await m.delete(PedidoCompraItem, { pedidoId: guardado.id });
    if (items.length) {
      for (const i of items) i.pedidoId = guardado.id;
      await m.save(PedidoCompraItem, items);
    }
    // Cambiar sólo renglones no toca la fila del pedido: igual cuenta como
    // cambio (sube la versión y la fecha de actualización).
    if (!esNuevo)
      await m.update(PedidoCompra, guardado.id, {
        actualizadoPorNombre: u.nombre,
      });
    return guardado.id;
  }

  private async cargar(ids: string[]): Promise<Map<string, PedidoCompra>> {
    if (!ids.length) return new Map();
    const lista = await this.pedidos.find({
      where: { id: In(ids) },
      relations: {
        proveedores: true,
        items: { categorias: true },
        comprobantes: true,
      },
      withDeleted: true,
    });
    return new Map(lista.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  }
}

function ordenar<T extends { orden: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orden - b.orden);
}

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

export function vista(p: PedidoCompra, ahora = new Date()): PedidoCompraVista {
  const items = ordenar(p.items ?? []).map((i) => ({
    id: i.id,
    productoId: i.productoId,
    nombre: i.nombre,
    cantidad: i.cantidad,
    cantidadRecibida: i.cantidadRecibida,
    precioUnitario: num(i.precioUnitario),
    afectaStock: i.afectaStock,
    categorias: (i.categorias ?? [])
      .map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden }))
      .sort((a, b) => a.orden - b.orden)
      .map(({ id, nombre }) => ({ id, nombre })),
  }));
  return {
    id: p.id,
    numero: p.numero,
    titulo: p.titulo,
    nota: p.nota,
    estado: p.estado,
    moneda: p.moneda,
    total: num(p.total),
    totalCalculado: totalCalculado(items),
    medioPago: p.medioPago,
    compradoAt: p.compradoAt,
    entregadoAt: p.entregadoAt,
    editableHasta: editableHasta(p.compradoAt),
    bloqueado: bloqueado(p.compradoAt, ahora),
    creadoPorNombre: p.creadoPorNombre,
    actualizadoPorNombre: p.actualizadoPorNombre,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    version: p.version,
    proveedores: (p.proveedores ?? [])
      .map((x) => ({ id: x.id, nombre: x.nombre, dadoDeBaja: !!x.deletedAt }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    items,
    comprobantes: (p.comprobantes ?? [])
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        mimeType: c.mimeType,
        tamanio: c.tamanio,
        subidoPorNombre: c.subidoPorNombre,
        createdAt: c.createdAt,
        costearEstado: c.costearEstado,
        costearDetalle: c.costearDetalle,
        costearEnviadoAt: c.costearEnviadoAt,
      })),
  };
}

function nombreArchivo(original: string): string {
  // multer entrega el nombre en latin1
  const n = Buffer.from(original ?? 'comprobante', 'latin1').toString('utf8');
  return n.replace(/[/\\]/g, '_').slice(0, 255) || 'comprobante';
}
