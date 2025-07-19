import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ConflictException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import { ProductoServicio, TipoProductoServicio } from '../entities/productoServicio.entity';
import { UnidadNegocio } from '../entities/unidadNegocio.entity';
import { 
  CrearProductoServicioDto, 
  ActualizarProductoServicioDto, 
  FiltrarProductosServiciosDto 
} from '../dto/producto-servicio.dto';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { TipoAccion } from '../../enums/TipoAccion.enum';
import { ModuloSistema } from '../../enums/ModuloSistema.enum';

export interface ProductosServiciosPaginados {
  data: ProductoServicio[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@Injectable()
export class ProductoServicioService {
  private readonly logger = new Logger(ProductoServicioService.name);

  constructor(
    @InjectRepository(ProductoServicio)
    private productoServicioRepository: Repository<ProductoServicio>,
    @InjectRepository(UnidadNegocio)
    private unidadNegocioRepository: Repository<UnidadNegocio>,
    private auditoriaService: AuditoriaService,
  ) {}

  async obtenerTodas(): Promise<ProductoServicio[]> {
    return this.productoServicioRepository.find({
      relations: ['unidadNegocio'],
      order: {
        nombre: 'ASC',
      },
    });
  }

  async crear(crearProductoServicioDto: CrearProductoServicioDto): Promise<ProductoServicio> {
    try {
      // Verificar si ya existe un producto/servicio con el mismo nombre
      const existente = await this.productoServicioRepository.findOne({
        where: { nombre: crearProductoServicioDto.nombre },
        withDeleted: true
      });

      if (existente && !existente.deletedAt) {
        throw new ConflictException(`Ya existe un producto/servicio con el nombre "${crearProductoServicioDto.nombre}"`);
      }

      // Verificar código de barras único si se proporciona
      if (crearProductoServicioDto.codigoBarras) {
        const existenteBarras = await this.productoServicioRepository.findOne({
          where: { codigoBarras: crearProductoServicioDto.codigoBarras },
          withDeleted: true
        });

        if (existenteBarras && !existenteBarras.deletedAt) {
          throw new ConflictException(`Ya existe un producto/servicio con el código de barras "${crearProductoServicioDto.codigoBarras}"`);
        }
      }
      console.log(crearProductoServicioDto);

      // Verificar que la unidad de negocio existe
      const unidadNegocio = await this.unidadNegocioRepository.findOne({
        where: { id: crearProductoServicioDto.unidadNegocioId }
      });

      if (!unidadNegocio) {
        throw new NotFoundException(`Unidad de negocio con ID ${crearProductoServicioDto.unidadNegocioId} no encontrada`);
      }

      const productoServicio = this.productoServicioRepository.create({
        ...crearProductoServicioDto,
        unidadNegocio
      });
      
      const guardado = await this.productoServicioRepository.save(productoServicio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_CREADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: guardado.id,
        descripcion: `Producto/Servicio creado: ${guardado.nombre}`,
      });

      this.logger.log(`Producto/Servicio creado: ${guardado.id} - ${guardado.nombre}`);
      return guardado;
    } catch (error) {
      this.logger.error(`Error creando producto/servicio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerTodos(filtros?: FiltrarProductosServiciosDto): Promise<ProductosServiciosPaginados> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'nombre';
      const orderDirection = filtros?.orderDirection || 'ASC';

      const queryBuilder = this.productoServicioRepository
        .createQueryBuilder('productoServicio')
        .leftJoinAndSelect('productoServicio.unidadNegocio', 'unidadNegocio');

      // Aplicar filtros
      this.aplicarFiltros(queryBuilder, filtros);

      // Aplicar ordenamiento
      const camposPermitidos = ['nombre', 'precio', 'tipo', 'unidadNegocioId', 'createdAt'];
      const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'nombre';
      queryBuilder.orderBy(`productoServicio.${campoOrdenamiento}`, orderDirection as 'ASC' | 'DESC');

      const [productosServicios, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

      return {
        data: productosServicios,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error obteniendo productos/servicios: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorId(id: string): Promise<ProductoServicio> {
    try {
      const productoServicio = await this.productoServicioRepository.findOne({
        where: { id },
        relations: ['unidadNegocio']
      });

      if (!productoServicio) {
        throw new NotFoundException(`Producto/Servicio con ID ${id} no encontrado`);
      }

      return productoServicio;
    } catch (error) {
      this.logger.error(`Error obteniendo producto/servicio por ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async actualizar(id: string, actualizarDto: ActualizarProductoServicioDto): Promise<ProductoServicio> {
    try {
      const productoServicio = await this.obtenerPorId(id);

      // Verificar nombre único si se está actualizando
      if (actualizarDto.nombre && actualizarDto.nombre !== productoServicio.nombre) {
        const existente = await this.productoServicioRepository.findOne({
          where: { nombre: actualizarDto.nombre },
          withDeleted: true
        });

        if (existente && existente.id !== id && !existente.deletedAt) {
          throw new ConflictException(`Ya existe un producto/servicio con el nombre "${actualizarDto.nombre}"`);
        }
      }

      // Verificar código de barras único si se está actualizando
      if (actualizarDto.codigoBarras && actualizarDto.codigoBarras !== productoServicio.codigoBarras) {
        const existenteBarras = await this.productoServicioRepository.findOne({
          where: { codigoBarras: actualizarDto.codigoBarras },
          withDeleted: true
        });

        if (existenteBarras && existenteBarras.id !== id && !existenteBarras.deletedAt) {
          throw new ConflictException(`Ya existe un producto/servicio con el código de barras "${actualizarDto.codigoBarras}"`);
        }
      }

      // Verificar unidad de negocio si se está actualizando
      if (actualizarDto.unidadNegocioId) {
        const unidadNegocio = await this.unidadNegocioRepository.findOne({
          where: { id: actualizarDto.unidadNegocioId }
        });

        if (!unidadNegocio) {
          throw new NotFoundException(`Unidad de negocio con ID ${actualizarDto.unidadNegocioId} no encontrada`);
        }
      }

      Object.assign(productoServicio, actualizarDto);
      const actualizado = await this.productoServicioRepository.save(productoServicio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: actualizado.id,
        descripcion: `Producto/Servicio actualizado: ${actualizado.nombre}`,
      });

      this.logger.log(`Producto/Servicio actualizado: ${actualizado.id} - ${actualizado.nombre}`);
      return actualizado;
    } catch (error) {
      this.logger.error(`Error actualizando producto/servicio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      const productoServicio = await this.obtenerPorId(id);
      await this.productoServicioRepository.softRemove(productoServicio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_ELIMINADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: productoServicio.id,
        descripcion: `Producto/Servicio eliminado: ${productoServicio.nombre}`,
      });

      this.logger.log(`Producto/Servicio eliminado: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando producto/servicio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async restaurar(id: string): Promise<ProductoServicio> {
    try {
      const productoServicio = await this.productoServicioRepository.findOne({
        where: { id },
        withDeleted: true
      });

      if (!productoServicio) {
        throw new NotFoundException(`Producto/Servicio con ID ${id} no encontrado`);
      }

      await this.productoServicioRepository.restore(id);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: productoServicio.id,
        descripcion: `Producto/Servicio restaurado: ${productoServicio.nombre}`,
      });

      this.logger.log(`Producto/Servicio restaurado: ${id}`);
      return await this.obtenerPorId(id);
    } catch (error) {
      this.logger.error(`Error restaurando producto/servicio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cambiarEstadoActivo(id: string, activo: boolean): Promise<ProductoServicio> {
    try {
      const productoServicio = await this.obtenerPorId(id);
      productoServicio.activo = activo;
      
      const actualizado = await this.productoServicioRepository.save(productoServicio);

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMISION_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: actualizado.id,
        descripcion: `Estado de Producto/Servicio cambiado a: ${activo ? 'activo' : 'inactivo'}`,
      });

      this.logger.log(`Estado de Producto/Servicio cambiado: ${id} - activo: ${activo}`);
      return actualizado;
    } catch (error) {
      this.logger.error(`Error cambiando estado de producto/servicio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerActivos(): Promise<ProductoServicio[]> {
    try {
      return await this.productoServicioRepository.find({
        where: { activo: true },
        relations: ['unidadNegocio'],
        order: { nombre: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo productos/servicios activos: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorUnidadNegocio(unidadNegocioId: string): Promise<ProductoServicio[]> {
    try {
      return await this.productoServicioRepository.find({
        where: { 
          unidadNegocio: { id: unidadNegocioId },
          activo: true 
        },
        relations: ['unidadNegocio'],
        order: { nombre: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo productos/servicios por unidad de negocio: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerEstadisticas(): Promise<any> {
    try {
      const total = await this.productoServicioRepository.count();
      const activos = await this.productoServicioRepository.count({ where: { activo: true } });
      const productos = await this.productoServicioRepository.count({ where: { tipo: TipoProductoServicio.PRODUCTO } });
      const servicios = await this.productoServicioRepository.count({ where: { tipo: TipoProductoServicio.SERVICIO } });

      return {
        total,
        activos,
        inactivos: total - activos,
        productos,
        servicios
      };
    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`, error.stack);
      throw error;
    }
  }

  private aplicarFiltros(queryBuilder: SelectQueryBuilder<ProductoServicio>, filtros?: FiltrarProductosServiciosDto): void {
    if (filtros?.nombre) {
      queryBuilder.andWhere('productoServicio.nombre ILIKE :nombre', { nombre: `%${filtros.nombre}%` });
    }

    if (filtros?.tipo) {
      queryBuilder.andWhere('productoServicio.tipo = :tipo', { tipo: filtros.tipo });
    }

    if (filtros?.unidadNegocioId) {
      queryBuilder.andWhere('productoServicio.unidadNegocioId = :unidadNegocioId', { unidadNegocioId: filtros.unidadNegocioId });
    }

    if (filtros?.activo !== undefined) {
      queryBuilder.andWhere('productoServicio.activo = :activo', { activo: filtros.activo });
    }

    if (filtros?.esPrecioCongelado !== undefined) {
      queryBuilder.andWhere('productoServicio.esPrecioCongelado = :esPrecioCongelado', { esPrecioCongelado: filtros.esPrecioCongelado });
    }
  }
}
