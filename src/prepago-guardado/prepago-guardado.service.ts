import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { CrearPrepagoGuardadoDto } from './dto/crear-prepago-guardado.dto';
import { ActualizarPrepagoGuardadoDto } from './dto/actualizar-prepago-guardado.dto';
import { FiltrarPrepagosGuardadosDto } from './dto/filtrar-prepagos-guardados.dto';
import { CambiarEstadoPrepagoDto } from './dto/cambiar-estado-prepago.dto';
import { EstadoPrepago } from '../enums/EstadoPrepago.enum';

@Injectable()
export class PrepagoGuardadoService {
    constructor(
        @InjectRepository(PrepagoGuardado)
        private readonly prepagoGuardadoRepository: Repository<PrepagoGuardado>,
        @InjectRepository(Cliente)
        private readonly clienteRepository: Repository<Cliente>,
    ) {}

    async crear(crearPrepagoGuardadoDto: CrearPrepagoGuardadoDto): Promise<PrepagoGuardado> {
        // Verificar que el cliente existe
        const cliente = await this.clienteRepository.findOne({
            where: { id: crearPrepagoGuardadoDto.clienteId },
        });

        if (!cliente) {
            throw new BadRequestException('El cliente especificado no existe');
        }

        const prepagoGuardado = this.prepagoGuardadoRepository.create({
            ...crearPrepagoGuardadoDto,
            cliente,
        });

        return await this.prepagoGuardadoRepository.save(prepagoGuardado);
    }

    async obtenerTodos(): Promise<PrepagoGuardado[]> {
        return await this.prepagoGuardadoRepository.find({
            relations: ['cliente'],
            order: { fechaCreacion: 'DESC' },
        });
    }

    async obtenerConPaginacion(filtros: FiltrarPrepagosGuardadosDto) {
        const { 
            page = 1, 
            limit = 10, 
            search, 
            moneda, 
            estado, 
            clienteId,
            orderBy = 'fechaCreacion', 
            order = 'DESC' 
        } = filtros;
        const skip = (page - 1) * limit;

        const queryBuilder = this.prepagoGuardadoRepository
            .createQueryBuilder('prepagoGuardado')
            .leftJoinAndSelect('prepagoGuardado.cliente', 'cliente');

        if (search) {
            queryBuilder.andWhere('prepagoGuardado.observaciones ILIKE :search', { 
                search: `%${search}%` 
            });
        }

        if (moneda) {
            queryBuilder.andWhere('prepagoGuardado.moneda = :moneda', { moneda });
        }

        if (estado) {
            queryBuilder.andWhere('prepagoGuardado.estado = :estado', { estado });
        }

        if (clienteId) {
            queryBuilder.andWhere('prepagoGuardado.cliente.id = :clienteId', { clienteId });
        }

        // Validar campo de ordenamiento
        const camposPermitidos = ['fechaCreacion', 'monto', 'estado'];
        const campoOrdenamiento = camposPermitidos.includes(orderBy) ? orderBy : 'fechaCreacion';
        
        queryBuilder.orderBy(`prepagoGuardado.${campoOrdenamiento}`, order as 'ASC' | 'DESC');

        const [prepagosGuardados, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            data: prepagosGuardados,
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

    async obtenerPorId(id: string): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoRepository.findOne({
            where: { id },
            relations: ['cliente'],
        });

        if (!prepagoGuardado) {
            throw new NotFoundException(`Prepago guardado con ID ${id} no encontrado`);
        }

        return prepagoGuardado;
    }

    async actualizar(id: string, actualizarPrepagoGuardadoDto: ActualizarPrepagoGuardadoDto): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.obtenerPorId(id);

        // Si se está actualizando el cliente, verificar que existe
        if (actualizarPrepagoGuardadoDto.clienteId) {
            const cliente = await this.clienteRepository.findOne({
                where: { id: actualizarPrepagoGuardadoDto.clienteId },
            });

            if (!cliente) {
                throw new BadRequestException('El cliente especificado no existe');
            }
        }

        Object.assign(prepagoGuardado, actualizarPrepagoGuardadoDto);
        return await this.prepagoGuardadoRepository.save(prepagoGuardado);
    }

    async cambiarEstado(id: string, cambiarEstadoPrepagoDto: CambiarEstadoPrepagoDto): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.obtenerPorId(id);

        // Validaciones específicas para cambios de estado
        if (cambiarEstadoPrepagoDto.estado === EstadoPrepago.UTILIZADA) {
            if (prepagoGuardado.estado !== EstadoPrepago.ACTIVA) {
                throw new BadRequestException('Solo se pueden utilizar prepagos que estén activos');
            }
        }

        if (cambiarEstadoPrepagoDto.estado === EstadoPrepago.VENCIDA) {
            if (prepagoGuardado.estado !== EstadoPrepago.ACTIVA) {
                throw new BadRequestException('Solo se pueden vencer prepagos que estén activos');
            }
        }

        // Actualizar estado y observaciones
        prepagoGuardado.estado = cambiarEstadoPrepagoDto.estado;
        if (cambiarEstadoPrepagoDto.observaciones) {
            prepagoGuardado.observaciones = cambiarEstadoPrepagoDto.observaciones;
        }

        return await this.prepagoGuardadoRepository.save(prepagoGuardado);
    }

    async eliminar(id: string): Promise<void> {
        const prepagoGuardado = await this.obtenerPorId(id);
        await this.prepagoGuardadoRepository.softRemove(prepagoGuardado);
    }

    async restaurar(id: string): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoRepository.findOne({
            where: { id },
            withDeleted: true,
        });

        if (!prepagoGuardado) {
            throw new NotFoundException(`Prepago guardado con ID ${id} no encontrado`);
        }

        if (!prepagoGuardado.deletedAt) {
            throw new BadRequestException('El prepago guardado no está eliminado');
        }

        await this.prepagoGuardadoRepository.restore(id);
        return await this.obtenerPorId(id);
    }

    async obtenerPorCliente(clienteId: string): Promise<PrepagoGuardado[]> {
        // Verificar que el cliente existe
        const cliente = await this.clienteRepository.findOne({
            where: { id: clienteId },
        });

        if (!cliente) {
            throw new NotFoundException(`Cliente con ID ${clienteId} no encontrado`);
        }

        return await this.prepagoGuardadoRepository.find({
            where: { cliente: { id: clienteId } },
            relations: ['cliente'],
            order: { fechaCreacion: 'DESC' },
        });
    }

    async obtenerEstadisticas() {
        const totalPrepagos = await this.prepagoGuardadoRepository.count();
        const prepagosActivos = await this.prepagoGuardadoRepository.count({
            where: { estado: EstadoPrepago.ACTIVA },
        });
        const prepagosUtilizados = await this.prepagoGuardadoRepository.count({
            where: { estado: EstadoPrepago.UTILIZADA },
        });
        const prepagosVencidos = await this.prepagoGuardadoRepository.count({
            where: { estado: EstadoPrepago.VENCIDA },
        });

        // Calcular montos totales por moneda
        const prepagosPesos = await this.prepagoGuardadoRepository
            .createQueryBuilder('prepagoGuardado')
            .select('SUM(prepagoGuardado.monto)', 'total')
            .where('prepagoGuardado.moneda = :moneda', { moneda: 'pesos' })
            .andWhere('prepagoGuardado.estado = :estado', { estado: EstadoPrepago.ACTIVA })
            .getRawOne();

        const prepagosDolares = await this.prepagoGuardadoRepository
            .createQueryBuilder('prepagoGuardado')
            .select('SUM(prepagoGuardado.monto)', 'total')
            .where('prepagoGuardado.moneda = :moneda', { moneda: 'dolares' })
            .andWhere('prepagoGuardado.estado = :estado', { estado: EstadoPrepago.ACTIVA })
            .getRawOne();

        return {
            totalPrepagos,
            prepagosActivos,
            prepagosUtilizados,
            prepagosVencidos,
            montosActivos: {
                pesos: Number(prepagosPesos?.total || 0),
                dolares: Number(prepagosDolares?.total || 0),
            },
        };
    }
} 