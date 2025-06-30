import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoComanda } from '../entities/TipoComanda.entity';
import { CrearTipoComandaDto, ActualizarTipoComandaDto } from '../dto/tipo-comanda.dto';

@Injectable()
export class TipoComandaService {
  constructor(
    @InjectRepository(TipoComanda)
    private tipoComandaRepository: Repository<TipoComanda>,
  ) {}

  async crear(crearTipoComandaDto: CrearTipoComandaDto): Promise<TipoComanda> {
    // Verificar si ya existe un tipo con el mismo nombre
    const tipoExistente = await this.tipoComandaRepository.findOne({
      where: { nombre: crearTipoComandaDto.nombre },
      withDeleted: true,
    });

    if (tipoExistente) {
      if (tipoExistente.deletedAt) {
        // Si está eliminado lógicamente, restaurarlo
        await this.tipoComandaRepository.restore(tipoExistente.id);
        Object.assign(tipoExistente, crearTipoComandaDto);
        return this.tipoComandaRepository.save(tipoExistente);
      } else {
        throw new ConflictException(`Ya existe un tipo de comanda con el nombre "${crearTipoComandaDto.nombre}"`);
      }
    }

    const nuevoTipo = this.tipoComandaRepository.create(crearTipoComandaDto);
    return this.tipoComandaRepository.save(nuevoTipo);
  }

  async findAll(): Promise<TipoComanda[]> {
    return this.tipoComandaRepository.find({
      where: { activo: true },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<TipoComanda> {
    const tipo = await this.tipoComandaRepository.findOne({
      where: { id, activo: true },
    });

    if (!tipo) {
      throw new NotFoundException(`Tipo de comanda con ID "${id}" no encontrado`);
    }

    return tipo;
  }

  async actualizar(id: string, actualizarTipoComandaDto: ActualizarTipoComandaDto): Promise<TipoComanda> {
    const tipo = await this.findOne(id);

    // Si se está cambiando el nombre, verificar que no exista otro con el mismo nombre
    if (actualizarTipoComandaDto.nombre && actualizarTipoComandaDto.nombre !== tipo.nombre) {
      const tipoExistente = await this.tipoComandaRepository.findOne({
        where: { nombre: actualizarTipoComandaDto.nombre },
        withDeleted: true,
      });

      if (tipoExistente && tipoExistente.id !== id) {
        throw new ConflictException(`Ya existe un tipo de comanda con el nombre "${actualizarTipoComandaDto.nombre}"`);
      }
    }

    Object.assign(tipo, actualizarTipoComandaDto);
    return this.tipoComandaRepository.save(tipo);
  }

  async eliminar(id: string): Promise<void> {
    const tipo = await this.findOne(id);

    // Verificar si hay comandas usando este tipo
    const comandasConTipo = await this.tipoComandaRepository
      .createQueryBuilder('tipo')
      .leftJoin('tipo.comandas', 'comanda')
      .where('tipo.id = :id', { id })
      .andWhere('comanda.id IS NOT NULL')
      .getCount();

    if (comandasConTipo > 0) {
      throw new ConflictException(
        `No se puede eliminar el tipo de comanda porque está siendo usado por ${comandasConTipo} comanda(s)`,
      );
    }

    await this.tipoComandaRepository.softDelete(id);
  }

  async restaurar(id: string): Promise<TipoComanda> {
    const tipo = await this.tipoComandaRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!tipo) {
      throw new NotFoundException(`Tipo de comanda con ID "${id}" no encontrado`);
    }

    if (!tipo.deletedAt) {
      throw new ConflictException(`El tipo de comanda no está eliminado`);
    }

    await this.tipoComandaRepository.restore(id);
    return this.findOne(id);
  }
} 