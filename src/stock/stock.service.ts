import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProductoStock } from './entities/ProductoStock.entity';
import { Trabajador } from '../personal/entities/Trabajador.entity';

const TABLA_ASIGNACIONES = 'productos_stock_trabajadores';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(ProductoStock)
    private readonly productoRepository: Repository<ProductoStock>,
    @InjectRepository(Trabajador)
    private readonly trabajadorRepository: Repository<Trabajador>,
    private readonly dataSource: DataSource,
  ) {}

  async listarProductos(): Promise<ProductoStock[]> {
    const productos = await this.productoRepository.find({
      relations: { trabajadores: true },
      order: { nombre: 'ASC' },
    });
    // Del trabajador solo id y nombre
    return productos.map((p) => ({
      ...p,
      trabajadores: p.trabajadores.map((t) => ({ id: t.id, nombre: t.nombre }) as Trabajador),
    }));
  }

  async crearProductos(nombres: string[]): Promise<ProductoStock[]> {
    const limpios = [...new Set(nombres.map((n) => n.trim()).filter(Boolean))];
    const guardados = await this.productoRepository.save(
      this.productoRepository.create(limpios.map((nombre) => ({ nombre }))),
    );
    return guardados.map((p) => ({ ...p, trabajadores: [] }));
  }

  async actualizarProducto(id: string, nombre: string): Promise<ProductoStock> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto) throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    producto.nombre = nombre.trim();
    return this.productoRepository.save(producto);
  }

  async eliminarProducto(id: string): Promise<void> {
    const result = await this.productoRepository.delete(id);
    if (!result.affected) throw new NotFoundException(`Producto con ID ${id} no encontrado`);
  }

  /** Reemplaza el set de productos que usa el trabajador. */
  async asignarProductos(trabajadorId: string, productoIds: string[]): Promise<string[]> {
    const trabajador = await this.trabajadorRepository.findOne({ where: { id: trabajadorId } });
    if (!trabajador) throw new NotFoundException(`Trabajador con ID ${trabajadorId} no encontrado`);

    const ids = [...new Set(productoIds)];
    if (ids.length) {
      const existentes = await this.productoRepository.count({ where: { id: In(ids) } });
      if (existentes !== ids.length) throw new NotFoundException('Alguno de los productos no existe');
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
}
