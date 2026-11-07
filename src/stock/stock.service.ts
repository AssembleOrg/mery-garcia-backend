import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ProductoStock } from './entities/ProductoStock.entity';
import { AjusteStock } from './entities/AjusteStock.entity';
import { Trabajador } from '../personal/entities/Trabajador.entity';
import {
  ajusteParaContado,
  cantidadArticulo,
  type MovimientosArticulo,
} from './cantidades-stock';

const TABLA_ASIGNACIONES = 'productos_stock_trabajadores';

export type ProductoStockConCantidad = ProductoStock & {
  /** Null = todavía no se lleva la cuenta (sin compras entregadas ni conteo). */
  cantidad: number | null;
  /** Queda poco (1 o 0, o el mínimo que le pusieron). */
  bajo: boolean;
};

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(ProductoStock)
    private readonly productoRepository: Repository<ProductoStock>,
    @InjectRepository(Trabajador)
    private readonly trabajadorRepository: Repository<Trabajador>,
    @InjectRepository(AjusteStock)
    private readonly ajusteRepository: Repository<AjusteStock>,
    private readonly dataSource: DataSource,
  ) {}

  async listarProductos(): Promise<ProductoStockConCantidad[]> {
    const productos = await this.productoRepository.find({
      relations: { trabajadores: true },
      order: { nombre: 'ASC' },
    });
    const movimientos = await this.movimientos();
    // Del trabajador solo id y nombre
    return productos.map((p) => ({
      ...p,
      ...cantidadArticulo(
        movimientos.get(p.id) ?? SIN_MOVIMIENTOS,
        p.stockMinimo,
      ),
      trabajadores: p.trabajadores.map(
        (t) => ({ id: t.id, nombre: t.nombre }) as Trabajador,
      ),
    }));
  }

  async crearProductos(nombres: string[]): Promise<ProductoStockConCantidad[]> {
    const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
    const guardados = await this.productoRepository.save(
      this.productoRepository.create(limpios.map((nombre) => ({ nombre }))),
    );
    return guardados.map((p) => ({
      ...p,
      trabajadores: [],
      cantidad: null,
      bajo: false,
    }));
  }

  async actualizarProducto(
    id: string,
    cambios: { nombre?: string; stockMinimo?: number | null },
  ): Promise<ProductoStock> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto)
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    if (cambios.nombre !== undefined) producto.nombre = cambios.nombre.trim();
    if (cambios.stockMinimo !== undefined)
      producto.stockMinimo = cambios.stockMinimo;
    return this.productoRepository.save(producto);
  }

  async eliminarProducto(id: string): Promise<void> {
    const result = await this.productoRepository.delete(id);
    if (!result.affected)
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
  }

  /**
   * Deja el artículo en lo que se contó (guarda la diferencia como ajuste).
   * Desde el primer conteo se empieza a llevar la cuenta.
   */
  async ajustarAContado(
    id: string,
    contado: number,
    motivo: string | undefined,
    hechoPorNombre: string | null,
  ): Promise<{ cantidad: number | null; bajo: boolean }> {
    return this.dataSource.transaction(async (m) => {
      // Uno a la vez por artículo, así dos conteos seguidos no suman doble.
      const producto = await m.findOne(ProductoStock, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto)
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      const actual =
        (await this.movimientos(m, [id])).get(id) ?? SIN_MOVIMIENTOS;
      await m.save(
        m.create(AjusteStock, {
          productoId: id,
          cantidad: ajusteParaContado(actual, contado),
          motivo: motivo?.trim() || 'Conteo',
          hechoPorNombre,
        }),
      );
      const despues =
        (await this.movimientos(m, [id])).get(id) ?? SIN_MOVIMIENTOS;
      return cantidadArticulo(despues, producto.stockMinimo);
    });
  }

  /** Ajustes del artículo, el último primero. */
  listarAjustes(productoId: string): Promise<AjusteStock[]> {
    return this.ajusteRepository.find({
      where: { productoId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /** Reemplaza el set de productos que usa el trabajador. */
  async asignarProductos(
    trabajadorId: string,
    productoIds: string[],
  ): Promise<string[]> {
    const trabajador = await this.trabajadorRepository.findOne({
      where: { id: trabajadorId },
    });
    if (!trabajador)
      throw new NotFoundException(
        `Trabajador con ID ${trabajadorId} no encontrado`,
      );

    const ids = [...new Set(productoIds)];
    if (ids.length) {
      const existentes = await this.productoRepository.count({
        where: { id: In(ids) },
      });
      if (existentes !== ids.length)
        throw new NotFoundException('Alguno de los productos no existe');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(TABLA_ASIGNACIONES)
        .where('"trabajadorId" = :trabajadorId', { trabajadorId })
        .execute();
      if (ids.length) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(TABLA_ASIGNACIONES)
          .values(ids.map((productoId) => ({ productoId, trabajadorId })))
          .execute();
      }
    });
    return ids;
  }

  /**
   * Entradas (compras entregadas, renglones que afectan stock), lo usado
   * (pedidos del personal aprobados) y ajustes, por artículo.
   */
  private async movimientos(
    m: EntityManager = this.dataSource.manager,
    soloIds?: string[],
  ): Promise<Map<string, MovimientosArticulo>> {
    const filas = await m.query<
      {
        id: string;
        entradas: string;
        usado: string;
        ajustes: string;
        controla: boolean;
      }[]
    >(
      `SELECT p.id,
              COALESCE(e.entradas, 0) AS entradas,
              COALESCE(u.usado, 0)    AS usado,
              COALESCE(a.ajustes, 0)  AS ajustes,
              (e.id IS NOT NULL OR a.id IS NOT NULL) AS controla
         FROM productos_stock p
         LEFT JOIN (
           SELECT i."productoId" AS id,
                  SUM(COALESCE(i."cantidadRecibida", i.cantidad)) AS entradas
             FROM compras_pedidos_items i
             JOIN compras_pedidos pc ON pc.id = i."pedidoId"
            WHERE i."afectaStock" AND i."productoId" IS NOT NULL
              AND pc.estado = 'ENTREGADO' AND pc."deletedAt" IS NULL
            GROUP BY i."productoId"
         ) e ON e.id = p.id
         LEFT JOIN (
           SELECT si."productoId" AS id, SUM(si.cantidad) AS usado
             FROM solicitudes_stock_items si
             JOIN solicitudes_stock s ON s.id = si."solicitudId"
            WHERE s.estado = 'APROBADA' AND si."productoId" IS NOT NULL
            GROUP BY si."productoId"
         ) u ON u.id = p.id
         LEFT JOIN (
           SELECT "productoId" AS id, SUM(cantidad) AS ajustes
             FROM stock_ajustes GROUP BY "productoId"
         ) a ON a.id = p.id
        ${soloIds ? 'WHERE p.id = ANY($1::uuid[])' : ''}`,
      soloIds ? [soloIds] : [],
    );
    return new Map(
      filas.map((f) => [
        f.id,
        {
          entradas: Number(f.entradas),
          usado: Number(f.usado),
          ajustes: Number(f.ajustes),
          controla: f.controla,
        },
      ]),
    );
  }
}

const SIN_MOVIMIENTOS: MovimientosArticulo = {
  entradas: 0,
  usado: 0,
  ajustes: 0,
  controla: false,
};
