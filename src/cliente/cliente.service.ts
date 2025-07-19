import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Cliente } from './entities/Cliente.entity';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { FiltrarClientesDto } from './dto/filtrar-clientes.dto';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(PrepagoGuardado)
    private readonly prepagoGuardadoRepository: Repository<PrepagoGuardado>,
  ) {}

  async crear(crearClienteDto: CrearClienteDto): Promise<Cliente> {
    const { señaUsd, señaArs, ...rest } = crearClienteDto;
    // Verificar si ya existe un cliente con el mismo CUIT
    if (rest.cuit) {
      const clienteExistente = await this.clienteRepository.findOne({
        where: { cuit: rest.cuit },
      });

      if (clienteExistente) {
        throw new BadRequestException('Ya existe un cliente con este CUIT');
      }
    }

    // Crear el cliente primero
    const cliente = this.clienteRepository.create(rest);
    const clienteGuardado = await this.clienteRepository.save(cliente);

    // Crear los prepagos guardados si se proporcionan
    if (señaUsd || señaArs) {
      const prepagosGuardados: PrepagoGuardado[] = [];

      if (señaUsd) {
        const prepagoGuardado = this.prepagoGuardadoRepository.create({
          monto: señaUsd,
          moneda: TipoMoneda.USD,
          estado: EstadoPrepago.ACTIVA,
          cliente: clienteGuardado,
          observaciones: 'Seña USD creada automáticamente',
        });
        prepagosGuardados.push(prepagoGuardado);
      }

      if (señaArs) {
        const prepagoGuardado = this.prepagoGuardadoRepository.create({
          monto: señaArs,
          moneda: TipoMoneda.ARS,
          estado: EstadoPrepago.ACTIVA,
          cliente: clienteGuardado,
          observaciones: 'Seña ARS creada automáticamente',
        });
        prepagosGuardados.push(prepagoGuardado);
      }

      if (prepagosGuardados.length > 0) {
        await this.prepagoGuardadoRepository.save(prepagosGuardados);
      }
    }

    // Retornar el cliente con los prepagos guardados
    return await this.obtenerPorId(clienteGuardado.id);
  }

  async obtenerTodos(): Promise<Cliente[]> {
    const clientes = await this.clienteRepository.find({
      relations: ['prepagosGuardados'],
      order: { nombre: 'ASC' },
    });

    // Calcular señas disponibles para cada cliente
    return clientes.map(cliente => {
      const señasDisponibles = {
        ars: 0,
        usd: 0,
      };

      if (cliente.prepagosGuardados) {
        const ars = cliente.prepagosGuardados
          .filter(pg => pg.moneda === TipoMoneda.ARS && pg.estado === EstadoPrepago.ACTIVA)
          .reduce((sum, pg) => sum + Number(pg.monto), 0);

        const usd = cliente.prepagosGuardados
          .filter(pg => pg.moneda === TipoMoneda.USD && pg.estado === EstadoPrepago.ACTIVA)
          .reduce((sum, pg) => sum + Number(pg.monto), 0);

        señasDisponibles.ars = ars;
        señasDisponibles.usd = usd;
      }

      return {
        ...cliente,
        señasDisponibles,
      };
    });
  }

  async obtenerConPaginacion(filtros: FiltrarClientesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = 'nombre',
      orderDirection = 'ASC',
      nombre,
    } = filtros;
    const skip = (page - 1) * limit;

    const queryBuilder = this.clienteRepository
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.prepagosGuardados', 'prepagosGuardados');

    if (search) {
      queryBuilder.andWhere(
        '(cliente.nombre ILIKE :search OR cliente.email ILIKE :search OR cliente.telefono ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (nombre) {
      queryBuilder.andWhere('cliente.nombre ILIKE :nombre', { nombre: `%${nombre}%` });
    }

    // Validar campo de ordenamiento
    const camposPermitidos = ['nombre', 'fechaRegistro', 'createdAt', 'tieneSeñas'];
    const campoOrdenamiento = camposPermitidos.includes(orderBy)
      ? orderBy
      : 'nombre';

    if (orderBy === 'tieneSeñas') {
      // Agregar subconsulta para contar señas activas
      queryBuilder.addSelect(
        `(SELECT COUNT(*) FROM prepagos_guardados pg WHERE pg.cliente_id = cliente.id AND pg.estado = 'activa')`,
        'tiene_senas'
      );
      queryBuilder.orderBy('tiene_senas', orderDirection as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy(
        `cliente.${campoOrdenamiento}`,
        orderDirection as 'ASC' | 'DESC',
      );
    }

    const [clientes, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Calcular señas disponibles para cada cliente
    const clientesConSeñas = clientes.map(cliente => {
      const señasDisponibles = {
        ars: 0,
        usd: 0,
      };

      if (cliente.prepagosGuardados) {
        const ars = cliente.prepagosGuardados
          .filter(pg => pg.moneda === TipoMoneda.ARS && pg.estado === EstadoPrepago.ACTIVA)
          .reduce((sum, pg) => sum + Number(pg.monto), 0);

        const usd = cliente.prepagosGuardados
          .filter(pg => pg.moneda === TipoMoneda.USD && pg.estado === EstadoPrepago.ACTIVA)
          .reduce((sum, pg) => sum + Number(pg.monto), 0);

        señasDisponibles.ars = ars;
        señasDisponibles.usd = usd;
      }

      // Limpiar el objeto cliente eliminando propiedades extra de la consulta
      const { tiene_senas, ...clienteLimpio } = cliente as any;

      return {
        ...clienteLimpio,
        señasDisponibles,
      };
    });

    return {
      data: clientesConSeñas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async obtenerPorId(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      relations: ['prepagosGuardados'],
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    // Calcular señas disponibles
    const señasDisponibles = {
      ars: 0,
      usd: 0,
    };

    if (cliente.prepagosGuardados) {
      const ars = cliente.prepagosGuardados
        .filter(pg => pg.moneda === TipoMoneda.ARS && pg.estado === EstadoPrepago.ACTIVA)
        .reduce((sum, pg) => sum + Number(pg.monto), 0);

      const usd = cliente.prepagosGuardados
        .filter(pg => pg.moneda === TipoMoneda.USD && pg.estado === EstadoPrepago.ACTIVA)
        .reduce((sum, pg) => sum + Number(pg.monto), 0);

      señasDisponibles.ars = ars;
      señasDisponibles.usd = usd;
    }

    return {
      ...cliente,
      señasDisponibles,
    };
  }

  async actualizar(
    id: string,
    actualizarClienteDto: ActualizarClienteDto,
  ): Promise<Cliente> {
    const cliente = await this.obtenerPorId(id);

    // Verificar si el CUIT ya existe en otro cliente
    if (
      actualizarClienteDto.cuit &&
      actualizarClienteDto.cuit !== cliente.cuit
    ) {
      const clienteExistente = await this.clienteRepository.findOne({
        where: { cuit: actualizarClienteDto.cuit },
      });

      if (clienteExistente) {
        throw new BadRequestException('Ya existe un cliente con este CUIT');
      }
    }

    Object.assign(cliente, actualizarClienteDto);
    const clienteActualizado = await this.clienteRepository.save(cliente);
    return await this.obtenerPorId(clienteActualizado.id);
  }

  async eliminar(id: string): Promise<void> {
    const cliente = await this.obtenerPorId(id);
    await this.clienteRepository.softRemove(cliente);
  }

  async restaurar(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    if (!cliente.deletedAt) {
      throw new BadRequestException('El cliente no está eliminado');
    }

    await this.clienteRepository.restore(id);
    return await this.obtenerPorId(id);
  }

  async obtenerEstadisticas() {
    const totalClientes = await this.clienteRepository.count();
    const clientesActivos = await this.clienteRepository.count({
      where: { deletedAt: undefined },
    });
    const clientesEliminados = totalClientes - clientesActivos;

    // Obtener clientes con señas disponibles
    const clientesConSeñas = await this.clienteRepository
      .createQueryBuilder('cliente')
      .leftJoin('cliente.prepagosGuardados', 'prepagosGuardados')
      .where('prepagosGuardados.estado = :estado', { estado: 'activa' })
      .getCount();

    return {
      totalClientes,
      clientesActivos,
      clientesEliminados,
      clientesConSeñas,
    };
  }
}
