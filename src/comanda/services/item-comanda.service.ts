import { 
  Injectable, 
  NotFoundException, 
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ItemComanda } from '../entities/ItemComanda.entity';
import { Comanda } from '../entities/Comanda.entity';
import { ProductoServicio } from '../entities/productoServicio.entity';
import { TipoItem } from '../entities/TipoItem.entity';
import { Trabajador } from '../../personal/entities/Trabajador.entity';
import { 
  CrearItemComandaDto, 
  ActualizarItemComandaDto, 
  FiltrarItemsComandaDto 
} from '../dto/item-comanda.dto';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { TipoAccion } from '../../enums/TipoAccion.enum';
import { ModuloSistema } from '../../enums/ModuloSistema.enum';

export interface ItemsComandaPaginados {
  data: ItemComanda[];
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
export class ItemComandaService {
  private readonly logger = new Logger(ItemComandaService.name);

  constructor(
    @InjectRepository(ItemComanda)
    private itemComandaRepository: Repository<ItemComanda>,
    @InjectRepository(Comanda)
    private comandaRepository: Repository<Comanda>,
    @InjectRepository(ProductoServicio)
    private productoServicioRepository: Repository<ProductoServicio>,
    @InjectRepository(TipoItem)
    private tipoItemRepository: Repository<TipoItem>,
    @InjectRepository(Trabajador)
    private trabajadorRepository: Repository<Trabajador>,
    private auditoriaService: AuditoriaService,
  ) {}

  async crear(crearItemComandaDto: CrearItemComandaDto): Promise<ItemComanda> {
    try {
      // Verificar que la comanda existe
      const comanda = await this.comandaRepository.findOne({
        where: { id: crearItemComandaDto.comandaId }
      });

      if (!comanda) {
        throw new NotFoundException(`Comanda con ID ${crearItemComandaDto.comandaId} no encontrada`);
      }

      // Verificar que el producto/servicio existe si se proporciona
      if (crearItemComandaDto.productoServicioId) {
        const productoServicio = await this.productoServicioRepository.findOne({
          where: { id: crearItemComandaDto.productoServicioId }
        });

        if (!productoServicio) {
          throw new NotFoundException(`Producto/Servicio con ID ${crearItemComandaDto.productoServicioId} no encontrado`);
        }
      }

      // Verificar que el tipo de item existe si se proporciona
      if (crearItemComandaDto.tipoId) {
        const tipoItem = await this.tipoItemRepository.findOne({
          where: { id: crearItemComandaDto.tipoId }
        });

        if (!tipoItem) {
          throw new NotFoundException(`Tipo de item con ID ${crearItemComandaDto.tipoId} no encontrado`);
        }
      }

      // Verificar que el trabajador existe si se proporciona
      if (crearItemComandaDto.trabajadorId) {
        const trabajador = await this.trabajadorRepository.findOne({
          where: { id: crearItemComandaDto.trabajadorId }
        });

        if (!trabajador) {
          throw new NotFoundException(`Trabajador con ID ${crearItemComandaDto.trabajadorId} no encontrado`);
        }
      }

      // Calcular subtotal si no se proporciona
      if (!crearItemComandaDto.subtotal) {
        const descuento = crearItemComandaDto.descuento || 0;
        crearItemComandaDto.subtotal = (crearItemComandaDto.precio * crearItemComandaDto.cantidad) - descuento;
      }

      const itemComanda = this.itemComandaRepository.create(crearItemComandaDto);
      const guardado = await this.itemComandaRepository.save(itemComanda);


      this.logger.log(`Item de comanda creado: ${guardado.id} - ${guardado.nombre}`);
      return guardado;
    } catch (error) {
      this.logger.error(`Error creando item de comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerTodos(filtros?: FiltrarItemsComandaDto): Promise<ItemsComandaPaginados> {
    try {
      const page = filtros?.page || 1;
      const limit = filtros?.limit || 20;
      const skip = (page - 1) * limit;
      const orderBy = filtros?.orderBy || 'nombre';
      const orderDirection = filtros?.orderDirection || 'ASC';

      const queryBuilder = this.itemComandaRepository
        .createQueryBuilder('itemComanda')
        .leftJoinAndSelect('itemComanda.comanda', 'comanda')
        .leftJoinAndSelect('itemComanda.productoServicio', 'productoServicio')
        .leftJoinAndSelect('itemComanda.tipo', 'tipo')
        .leftJoinAndSelect('itemComanda.trabajador', 'trabajador');

      // Aplicar filtros
      this.aplicarFiltros(queryBuilder, filtros);

      // Aplicar ordenamiento
      const camposPermitidos = ['nombre', 'precio', 'cantidad', 'createdAt'];
      const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'nombre';
      queryBuilder.orderBy(`itemComanda.${campoOrdenamiento}`, orderDirection as 'ASC' | 'DESC');

      const [itemsComanda, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();

      return {
        data: itemsComanda,
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
      this.logger.error(`Error obteniendo items de comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorId(id: string): Promise<ItemComanda> {
    try {
      const itemComanda = await this.itemComandaRepository.findOne({
        where: { id },
        relations: ['comanda', 'productoServicio', 'tipo', 'trabajador']
      });

      if (!itemComanda) {
        throw new NotFoundException(`Item de comanda con ID ${id} no encontrado`);
      }

      return itemComanda;
    } catch (error) {
      this.logger.error(`Error obteniendo item de comanda por ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async actualizar(id: string, actualizarDto: ActualizarItemComandaDto): Promise<ItemComanda> {
    try {
      const itemComanda = await this.obtenerPorId(id);

      // Verificar que la comanda existe si se está actualizando
      if (actualizarDto.comandaId) {
        const comanda = await this.comandaRepository.findOne({
          where: { id: actualizarDto.comandaId }
        });

        if (!comanda) {
          throw new NotFoundException(`Comanda con ID ${actualizarDto.comandaId} no encontrada`);
        }
      }

      // Verificar que el producto/servicio existe si se está actualizando
      if (actualizarDto.productoServicioId) {
        const productoServicio = await this.productoServicioRepository.findOne({
          where: { id: actualizarDto.productoServicioId }
        });

        if (!productoServicio) {
          throw new NotFoundException(`Producto/Servicio con ID ${actualizarDto.productoServicioId} no encontrado`);
        }
      }

      // Verificar que el tipo de item existe si se está actualizando
      if (actualizarDto.tipoId) {
        const tipoItem = await this.tipoItemRepository.findOne({
          where: { id: actualizarDto.tipoId }
        });

        if (!tipoItem) {
          throw new NotFoundException(`Tipo de item con ID ${actualizarDto.tipoId} no encontrado`);
        }
      }

      // Verificar que el trabajador existe si se está actualizando
      if (actualizarDto.trabajadorId) {
        const trabajador = await this.trabajadorRepository.findOne({
          where: { id: actualizarDto.trabajadorId }
        });

        if (!trabajador) {
          throw new NotFoundException(`Trabajador con ID ${actualizarDto.trabajadorId} no encontrado`);
        }
      }

      // Recalcular subtotal si se actualizan precio, cantidad o descuento
      if (actualizarDto.precio !== undefined || actualizarDto.cantidad !== undefined || actualizarDto.descuento !== undefined) {
        const precio = actualizarDto.precio ?? itemComanda.precio;
        const cantidad = actualizarDto.cantidad ?? itemComanda.cantidad;
        const descuento = actualizarDto.descuento ?? itemComanda.descuento;
        actualizarDto.subtotal = (precio * cantidad) - descuento;
      }

      Object.assign(itemComanda, actualizarDto);
      const actualizado = await this.itemComandaRepository.save(itemComanda);



      this.logger.log(`Item de comanda actualizado: ${actualizado.id} - ${actualizado.nombre}`);
      return actualizado;
    } catch (error) {
      this.logger.error(`Error actualizando item de comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    try {
      const itemComanda = await this.obtenerPorId(id);
      await this.itemComandaRepository.softRemove(itemComanda);



      this.logger.log(`Item de comanda eliminado: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando item de comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async restaurar(id: string): Promise<ItemComanda> {
    try {
      const itemComanda = await this.itemComandaRepository.findOne({
        where: { id },
        withDeleted: true
      });

      if (!itemComanda) {
        throw new NotFoundException(`Item de comanda con ID ${id} no encontrado`);
      }

      await this.itemComandaRepository.restore(id);



      this.logger.log(`Item de comanda restaurado: ${id}`);
      return await this.obtenerPorId(id);
    } catch (error) {
      this.logger.error(`Error restaurando item de comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  async obtenerPorComanda(comandaId: string): Promise<ItemComanda[]> {
    try {
      return await this.itemComandaRepository.find({
        where: { comanda: { id: comandaId } },
        relations: ['productoServicio', 'tipo', 'trabajador'],
        order: { createdAt: 'ASC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo items por comanda: ${error.message}`, error.stack);
      throw error;
    }
  }

  private aplicarFiltros(queryBuilder: SelectQueryBuilder<ItemComanda>, filtros?: FiltrarItemsComandaDto): void {
    if (filtros?.nombre) {
      queryBuilder.andWhere('itemComanda.nombre ILIKE :nombre', { nombre: `%${filtros.nombre}%` });
    }

    if (filtros?.comandaId) {
      queryBuilder.andWhere('itemComanda.comandaId = :comandaId', { comandaId: filtros.comandaId });
    }

    if (filtros?.productoServicioId) {
      queryBuilder.andWhere('itemComanda.productoServicioId = :productoServicioId', { productoServicioId: filtros.productoServicioId });
    }

    if (filtros?.trabajadorId) {
      queryBuilder.andWhere('itemComanda.trabajadorId = :trabajadorId', { trabajadorId: filtros.trabajadorId });
    }
  }
} 