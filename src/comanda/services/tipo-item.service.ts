import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoItem } from '../entities/TipoItem.entity';
import { CrearTipoItemDto, ActualizarTipoItemDto } from '../dto/tipo-item.dto';

@Injectable()
export class TipoItemService {
  constructor(
    @InjectRepository(TipoItem)
    private tipoItemRepository: Repository<TipoItem>,
  ) {}

  async crear(crearTipoItemDto: CrearTipoItemDto): Promise<TipoItem> {
    // Verificar si ya existe un tipo con el mismo nombre
    const tipoExistente = await this.tipoItemRepository.findOne({
      where: { nombre: crearTipoItemDto.nombre },
      withDeleted: true,
    });

    if (tipoExistente) {
      if (tipoExistente.deletedAt) {
        // Si está eliminado lógicamente, restaurarlo
        await this.tipoItemRepository.restore(tipoExistente.id);
        Object.assign(tipoExistente, crearTipoItemDto);
        return this.tipoItemRepository.save(tipoExistente);
      } else {
        throw new ConflictException(`Ya existe un tipo de item con el nombre "${crearTipoItemDto.nombre}"`);
      }
    }

    const nuevoTipo = this.tipoItemRepository.create(crearTipoItemDto);
    return this.tipoItemRepository.save(nuevoTipo);
  }

  async findAll(): Promise<TipoItem[]> {
    return this.tipoItemRepository.find({
      where: { activo: true },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<TipoItem> {
    const tipo = await this.tipoItemRepository.findOne({
      where: { id, activo: true },
    });

    if (!tipo) {
      throw new NotFoundException(`Tipo de item con ID "${id}" no encontrado`);
    }

    return tipo;
  }

  async actualizar(id: string, actualizarTipoItemDto: ActualizarTipoItemDto): Promise<TipoItem> {
    const tipo = await this.findOne(id);

    // Si se está cambiando el nombre, verificar que no exista otro con el mismo nombre
    if (actualizarTipoItemDto.nombre && actualizarTipoItemDto.nombre !== tipo.nombre) {
      const tipoExistente = await this.tipoItemRepository.findOne({
        where: { nombre: actualizarTipoItemDto.nombre },
        withDeleted: true,
      });

      if (tipoExistente && tipoExistente.id !== id) {
        throw new ConflictException(`Ya existe un tipo de item con el nombre "${actualizarTipoItemDto.nombre}"`);
      }
    }

    Object.assign(tipo, actualizarTipoItemDto);
    return this.tipoItemRepository.save(tipo);
  }

  async eliminar(id: string): Promise<void> {
    const tipo = await this.findOne(id);

    // Verificar si hay items usando este tipo
    const itemsConTipo = await this.tipoItemRepository
      .createQueryBuilder('tipo')
      .leftJoin('tipo.items', 'item')
      .where('tipo.id = :id', { id })
      .andWhere('item.id IS NOT NULL')
      .getCount();

    if (itemsConTipo > 0) {
      throw new ConflictException(
        `No se puede eliminar el tipo de item porque está siendo usado por ${itemsConTipo} item(s)`,
      );
    }

    await this.tipoItemRepository.softDelete(id);
  }

  async restaurar(id: string): Promise<TipoItem> {
    const tipo = await this.tipoItemRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!tipo) {
      throw new NotFoundException(`Tipo de item con ID "${id}" no encontrado`);
    }

    if (!tipo.deletedAt) {
      throw new ConflictException(`El tipo de item no está eliminado`);
    }

    await this.tipoItemRepository.restore(id);
    return this.findOne(id);
  }
} 