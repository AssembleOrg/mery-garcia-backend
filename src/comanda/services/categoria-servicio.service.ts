import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CategoriaServicio } from '../entities/categoriaServicio.entity';
import { ProductoServicio, TipoProductoServicio } from '../entities/productoServicio.entity';
import {
  ActualizarCategoriaServicioDto,
  CrearCategoriaServicioDto,
} from '../dto/categoria-servicio.dto';

@Injectable()
export class CategoriaServicioService {
  private readonly logger = new Logger(CategoriaServicioService.name);

  constructor(
    @InjectRepository(CategoriaServicio)
    private readonly categorias: Repository<CategoriaServicio>,
    private readonly dataSource: DataSource,
  ) {}

  /** Todas las categorías con sus servicios, en orden. */
  async obtenerTodas(): Promise<CategoriaServicio[]> {
    const lista = await this.categorias
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.servicios', 's', 's.deletedAt IS NULL')
      .leftJoinAndSelect('s.unidadNegocio', 'un')
      .orderBy('c.orden', 'ASC')
      .addOrderBy('c.nombre', 'ASC')
      .addOrderBy('s.nombre', 'ASC')
      .getMany();
    return lista;
  }

  async obtenerPorId(id: string): Promise<CategoriaServicio> {
    const categoria = await this.categorias
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.servicios', 's', 's.deletedAt IS NULL')
      .leftJoinAndSelect('s.unidadNegocio', 'un')
      .where('c.id = :id', { id })
      .orderBy('s.nombre', 'ASC')
      .getOne();
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  async crear(dto: CrearCategoriaServicioDto): Promise<CategoriaServicio> {
    const nombre = dto.nombre.trim();
    await this.verificarNombreLibre(nombre);

    const id = await this.dataSource.transaction(async (m) => {
      const orden = dto.orden ?? (await this.siguienteOrden(m));
      const creada = await m.save(
        m.create(CategoriaServicio, {
          nombre,
          descripcion: dto.descripcion?.trim() || null,
          orden,
        }),
      );
      if (dto.servicioIds) await this.asignarServicios(m, creada.id, dto.servicioIds);
      return creada.id;
    });

    this.logger.log(`Categoría de servicio creada: ${nombre}`);
    return this.obtenerPorId(id);
  }

  async actualizar(id: string, dto: ActualizarCategoriaServicioDto): Promise<CategoriaServicio> {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (nombre.toLowerCase() !== categoria.nombre.toLowerCase()) {
        await this.verificarNombreLibre(nombre, id);
      }
      categoria.nombre = nombre;
    }
    if (dto.descripcion !== undefined) categoria.descripcion = dto.descripcion?.trim() || null;
    if (dto.orden !== undefined) categoria.orden = dto.orden;

    await this.dataSource.transaction(async (m) => {
      await m.save(categoria);
      if (dto.servicioIds) await this.asignarServicios(m, id, dto.servicioIds);
    });

    return this.obtenerPorId(id);
  }

  /** Borra la categoría. Sus servicios quedan sin categoría. */
  async eliminar(id: string): Promise<void> {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    await this.dataSource.transaction(async (m) => {
      await m
        .createQueryBuilder()
        .update(ProductoServicio)
        .set({ categoria: null })
        .where('categoria_id = :id', { id })
        .execute();
      await m.delete(CategoriaServicio, id);
    });
    this.logger.log(`Categoría de servicio eliminada: ${categoria.nombre}`);
  }

  /**
   * Deja en la categoría exactamente los servicios indicados: los que estaban
   * y ya no vienen quedan sin categoría. Un servicio pertenece a una sola
   * categoría, así que si estaba en otra, se mueve.
   */
  private async asignarServicios(m: EntityManager, categoriaId: string, servicioIds: string[]) {
    const ids = [...new Set(servicioIds)];
    if (ids.length > 0) {
      const encontrados = await m.find(ProductoServicio, {
        where: { id: In(ids), tipo: TipoProductoServicio.SERVICIO },
        select: ['id'],
      });
      if (encontrados.length !== ids.length) {
        throw new BadRequestException('Alguno de los servicios no existe o no es un servicio.');
      }
    }

    const quitar = m
      .createQueryBuilder()
      .update(ProductoServicio)
      .set({ categoria: null })
      .where('categoria_id = :categoriaId', { categoriaId });
    if (ids.length > 0) quitar.andWhere('id NOT IN (:...ids)', { ids });
    await quitar.execute();

    if (ids.length > 0) {
      await m
        .createQueryBuilder()
        .update(ProductoServicio)
        .set({ categoria: { id: categoriaId } })
        .where('id IN (:...ids)', { ids })
        .execute();
    }
  }

  private async verificarNombreLibre(nombre: string, exceptoId?: string) {
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    const qb = this.categorias
      .createQueryBuilder('c')
      .where('LOWER(c.nombre) = LOWER(:nombre)', { nombre });
    if (exceptoId) qb.andWhere('c.id <> :exceptoId', { exceptoId });
    if (await qb.getExists()) {
      throw new ConflictException(`Ya existe una categoría llamada "${nombre}"`);
    }
  }

  private async siguienteOrden(m: EntityManager): Promise<number> {
    const r = await m
      .createQueryBuilder(CategoriaServicio, 'c')
      .select('COALESCE(MAX(c.orden), 0)', 'max')
      .getRawOne<{ max: number }>();
    return Number(r?.max ?? 0) + 1;
  }
}
