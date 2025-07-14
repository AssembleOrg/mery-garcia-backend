import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder, In } from 'typeorm';
import { Comanda, EstadoComanda } from './entities/Comanda.entity';
import { ItemComanda } from './entities/ItemComanda.entity';
import { TipoComanda } from './entities/TipoComanda.entity';
import { TipoItem } from './entities/TipoItem.entity';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { MetodoPago } from 'src/cliente/entities/MetodoPago.entity';
import { Prepago } from 'src/personal/entities/Prepago.entity';
import { CrearComandaDto } from './dto/crear-comanda.dto';
import { ActualizarComandaDto } from './dto/actualizar-comanda.dto';
import { FiltrarComandasDto } from './dto/filtrar-comandas.dto';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Caja } from 'src/enums/Caja.enum';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as ExcelJS from 'exceljs';
import { ConfiguracionSistema } from 'src/config/entities/ConfiguracionSistema.entity';
import { DolarService } from 'src/config/services/dolar.service';

export interface ComandaResponse {
  comanda: Comanda;
  totalItems: number;
  totalCalculado: number;
}

export interface ComandasPaginadas {
  comandas: Comanda[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ComandaExportData {
  numero: string;
  fecha: string;
  cliente: string;
  personal: string;
  estado: string;
  tipo: string;
  subtotal: number;
  totalDescuentos: number;
  totalRecargos: number;
  totalFinal: number;
  observaciones?: string;
  items: Array<{
    nombre: string;
    tipo: string;
    precio: number;
    cantidad: number;
    descuento: number;
    subtotal: number;
    personal: string;
  }>;
}

@Injectable()
export class ComandaService {
  private readonly logger = new Logger(ComandaService.name);

  constructor(
    @InjectRepository(Comanda)
    private comandaRepository: Repository<Comanda>,
    @InjectRepository(ItemComanda)
    private itemComandaRepository: Repository<ItemComanda>,
    @InjectRepository(TipoComanda)
    private tipoComandaRepository: Repository<TipoComanda>,
    @InjectRepository(TipoItem)
    private tipoItemRepository: Repository<TipoItem>,
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
    @InjectRepository(MetodoPago)
    private metodoPagoRepository: Repository<MetodoPago>,
    @InjectRepository(Prepago)
    private prepagoRepository: Repository<Prepago>,
    private dataSource: DataSource,
    private auditoriaService: AuditoriaService,
    private dolarService: DolarService,
  ) {}

  async crearComanda(
    crearComandaDto: CrearComandaDto,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ComandaResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el número de comanda sea único
      const comandaExistente = await queryRunner.manager.findOne(Comanda, {
        where: { numero: crearComandaDto.numero },
        withDeleted: true,
      });

      const dolar = await this.dolarService.obtenerUltimoDolarGuardado();

      if (!dolar) {
        throw new BadRequestException('No se encontró el precio del dólar');
      }

      if (comandaExistente) {
        throw new BadRequestException(`Ya existe una comanda con el número ${crearComandaDto.numero}`);
      }

      // Verificar que el cliente existe
      const cliente = await queryRunner.manager.findOne(Cliente, {
        where: { id: crearComandaDto.clienteId },
      });

      if (!cliente) {
        throw new NotFoundException(`Cliente con ID ${crearComandaDto.clienteId} no encontrado`);
      }

      // Verificar que el personal principal existe
      const personalPrincipal = await queryRunner.manager.findOne(Personal, {
        where: { id: crearComandaDto.personalPrincipalId },
      });

      if (!personalPrincipal) {
        throw new NotFoundException(`Personal con ID ${crearComandaDto.personalPrincipalId} no encontrado`);
      }

      // Verificar que el tipo de comanda existe
      const tipoComanda = await queryRunner.manager.findOne(TipoComanda, {
        where: { id: crearComandaDto.tipoId },
      });

      if (!tipoComanda) {
        throw new NotFoundException(`Tipo de comanda con ID ${crearComandaDto.tipoId} no encontrado`);
      }

      // Crear la comanda
      const comanda = queryRunner.manager.create(Comanda, {
        numero: crearComandaDto.numero,
        fecha: new Date(crearComandaDto.fecha),
        unidadNegocio: crearComandaDto.unidadNegocio,
        enCaja: crearComandaDto.enCaja || Caja.CAJA_1,
        cliente,
        personalPrincipal,
        subtotal: crearComandaDto.subtotal || 0,
        totalDescuentos: crearComandaDto.totalDescuentos || 0,
        totalRecargos: crearComandaDto.totalRecargos || 0,
        totalPrepago: crearComandaDto.totalPrepago || 0,
        totalFinal: crearComandaDto.totalFinal || 0,
        estado: crearComandaDto.estado || EstadoComanda.PENDIENTE,
        tipo: tipoComanda,
        observaciones: crearComandaDto.observaciones,
        precioDolar: dolar.compra,
      });

      const comandaGuardada = await queryRunner.manager.save(Comanda, comanda);

      // Crear los items de la comanda
      const items: ItemComanda[] = [];
      let totalCalculado = 0;

      for (const itemDto of crearComandaDto.items) {
        // Verificar que el personal del item existe
        const personal = await queryRunner.manager.findOne(Personal, {
          where: { id: itemDto.personalId },
        });

        if (!personal) {
          throw new NotFoundException(`Personal con ID ${itemDto.personalId} no encontrado`);
        }

        // Verificar que el tipo de item existe
        const tipoItem = await queryRunner.manager.findOne(TipoItem, {
          where: { id: itemDto.tipoId },
        });

        if (!tipoItem) {
          throw new NotFoundException(`Tipo de item con ID ${itemDto.tipoId} no encontrado`);
        }

        const subtotal = (itemDto.precio * itemDto.cantidad) - (itemDto.descuento ?? 0);
        totalCalculado += subtotal;

        const item = queryRunner.manager.create(ItemComanda, {
          productoServicioId: itemDto.productoServicioId,
          nombre: itemDto.nombre,
          tipo: tipoItem,
          precio: itemDto.precio,
          cantidad: itemDto.cantidad,
          descuento: itemDto.descuento,
          subtotal,
          comanda: comandaGuardada,
          personal,
        });

        const itemGuardado = await queryRunner.manager.save(ItemComanda, item);
        items.push(itemGuardado);
      }

      // Asociar métodos de pago si se proporcionan
      if (crearComandaDto.metodosPagoIds && crearComandaDto.metodosPagoIds.length > 0) {
        const metodosPago = await queryRunner.manager.findBy(MetodoPago, { id: In(crearComandaDto.metodosPagoIds) });
        comandaGuardada.metodosPago = metodosPago;
      }

      // Asociar prepago si se proporciona
      if (crearComandaDto.prepagoId) {
        const prepago = await queryRunner.manager.findOne(Prepago, {
          where: { id: crearComandaDto.prepagoId },
        });

        if (!prepago) {
          throw new NotFoundException(`Prepago con ID ${crearComandaDto.prepagoId} no encontrado`);
        }

        comandaGuardada.prepago = prepago;
      }

      // Actualizar totales si no se proporcionaron
      if (!crearComandaDto.subtotal) {
        comandaGuardada.subtotal = totalCalculado;
      }
      if (!crearComandaDto.totalFinal) {
        comandaGuardada.totalFinal = totalCalculado + 
          (crearComandaDto.totalRecargos || 0) - 
          (crearComandaDto.totalDescuentos || 0) - 
          (crearComandaDto.totalPrepago || 0);
      }

      const comandaFinal = await queryRunner.manager.save(Comanda, comandaGuardada);

      // Registrar en auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_CREADA,
        modulo: ModuloSistema.COMANDA,
        descripcion: `Comanda ${comandaFinal.numero} creada`,
        datosNuevos: { comanda: comandaFinal, items },
        observaciones: `Creada por ${usuario.nombre}`,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      await queryRunner.commitTransaction();

      return {
        comanda: comandaFinal,
        totalItems: items.length,
        totalCalculado,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerComanda(id: string): Promise<Comanda> {
    const comanda = await this.comandaRepository.findOne({
      where: { id },
      relations: [
        'cliente',
        'personalPrincipal',
        'items',
        'items.personal',
        'metodosPago',
        'prepago',
        'comisiones',
      ],
    });

    if (!comanda) {
      throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
    }

    return comanda;
  }

  async obtenerComandaPorNumero(numero: string): Promise<Comanda> {
    const comanda = await this.comandaRepository.findOne({
      where: { numero },
      relations: [
        'cliente',
        'personalPrincipal',
        'items',
        'items.personal',
        'metodosPago',
        'prepago',
        'comisiones',
      ],
    });

    if (!comanda) {
      throw new NotFoundException(`Comanda con número ${numero} no encontrada`);
    }

    return comanda;
  }

  async filtrarComandas(
    filtros: Partial<FiltrarComandasDto>,
    usuario?: Personal,
  ): Promise<ComandasPaginadas> {
    const queryBuilder = this.comandaRepository
      .createQueryBuilder('comanda')
      .leftJoinAndSelect('comanda.cliente', 'cliente')
      .leftJoinAndSelect('comanda.personalPrincipal', 'personalPrincipal')
      .leftJoinAndSelect('comanda.tipo', 'tipo')
      .leftJoinAndSelect('comanda.items', 'items')
      .leftJoinAndSelect('items.personal', 'itemPersonal')
      .leftJoinAndSelect('items.tipo', 'itemTipo')
      .leftJoinAndSelect('comanda.metodosPago', 'metodosPago')
      .leftJoinAndSelect('comanda.prepago', 'prepago');

    // Aplicar filtros
    this.aplicarFiltros(queryBuilder, filtros);

    // Contar total
    const total = await queryBuilder.getCount();

    // Aplicar paginación y ordenamiento
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    const orderBy = filtros.orderBy || 'fecha';
    const orderDirection = filtros.orderDirection || 'DESC';

    queryBuilder
      .orderBy(`comanda.${orderBy}`, orderDirection)
      .skip(offset)
      .take(limit);

    const comandas = await queryBuilder.getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      comandas,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async actualizarComanda(
    id: string,
    actualizarComandaDto: ActualizarComandaDto,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comanda> {
    const comanda = await this.obtenerComanda(id);

    // Guardar datos anteriores para auditoría
    const datosAnteriores = { ...comanda };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar número único si se está cambiando
      if (actualizarComandaDto.numero && actualizarComandaDto.numero !== comanda.numero) {
        const comandaExistente = await queryRunner.manager.findOne(Comanda, {
          where: { numero: actualizarComandaDto.numero },
          withDeleted: true,
        });

        if (comandaExistente) {
          throw new BadRequestException(`Ya existe una comanda con el número ${actualizarComandaDto.numero}`);
        }
      }

      // Actualizar campos básicos
      if (actualizarComandaDto.numero) comanda.numero = actualizarComandaDto.numero;
      if (actualizarComandaDto.fecha) comanda.fecha = new Date(actualizarComandaDto.fecha);
      if (actualizarComandaDto.unidadNegocio) comanda.unidadNegocio = actualizarComandaDto.unidadNegocio;
      if (actualizarComandaDto.enCaja) comanda.enCaja = actualizarComandaDto.enCaja;
      if (actualizarComandaDto.estado) comanda.estado = actualizarComandaDto.estado;
      if (actualizarComandaDto.observaciones !== undefined) comanda.observaciones = actualizarComandaDto.observaciones;
      if (actualizarComandaDto.precioDolar) comanda.precioDolar = actualizarComandaDto.precioDolar;

      // Actualizar relaciones si se proporcionan
      if (actualizarComandaDto.clienteId) {
        const cliente = await queryRunner.manager.findOne(Cliente, {
          where: { id: actualizarComandaDto.clienteId },
        });
        if (!cliente) {
          throw new NotFoundException(`Cliente con ID ${actualizarComandaDto.clienteId} no encontrado`);
        }
        comanda.cliente = cliente;
      }

      if (actualizarComandaDto.personalPrincipalId) {
        const personal = await queryRunner.manager.findOne(Personal, {
          where: { id: actualizarComandaDto.personalPrincipalId },
        });
        if (!personal) {
          throw new NotFoundException(`Personal con ID ${actualizarComandaDto.personalPrincipalId} no encontrado`);
        }
        comanda.personalPrincipal = personal;
      }

      // Actualizar items si se proporcionan
      if (actualizarComandaDto.items) {
        // Eliminar items existentes
        await queryRunner.manager.delete(ItemComanda, { comanda: { id } });

        // Crear nuevos items
        for (const itemDto of actualizarComandaDto.items) {
          if (!itemDto.personalId || !itemDto.precio || !itemDto.cantidad || itemDto.descuento === undefined) {
            throw new BadRequestException('Todos los campos del item son requeridos: personalId, precio, cantidad, descuento');
          }

          const personal = await queryRunner.manager.findOne(Personal, {
            where: { id: itemDto.personalId },
          });

          if (!personal) {
            throw new NotFoundException(`Personal con ID ${itemDto.personalId} no encontrado`);
          }

          const subtotal = (itemDto.precio * itemDto.cantidad) - itemDto.descuento;

          const item = queryRunner.manager.create(ItemComanda, {
            productoServicioId: itemDto.productoServicioId || '',
            nombre: itemDto.nombre || '',
            precio: itemDto.precio,
            cantidad: itemDto.cantidad,
            descuento: itemDto.descuento,
            subtotal,
            comanda,
            personal,
          });

          await queryRunner.manager.save(ItemComanda, item);
        }
      }

      // Actualizar métodos de pago
      if (actualizarComandaDto.metodosPagoIds) {
        const metodosPago = await queryRunner.manager.findBy(MetodoPago, { id: In(actualizarComandaDto.metodosPagoIds) });
        comanda.metodosPago = metodosPago;
      }

      // Actualizar prepago
      if (actualizarComandaDto.prepagoId) {
        const prepago = await queryRunner.manager.findOne(Prepago, {
          where: { id: actualizarComandaDto.prepagoId },
        });
        if (!prepago) {
          throw new NotFoundException(`Prepago con ID ${actualizarComandaDto.prepagoId} no encontrado`);
        }
        comanda.prepago = prepago;
      }

      // Actualizar totales
      if (actualizarComandaDto.subtotal !== undefined) comanda.subtotal = actualizarComandaDto.subtotal;
      if (actualizarComandaDto.totalDescuentos !== undefined) comanda.totalDescuentos = actualizarComandaDto.totalDescuentos;
      if (actualizarComandaDto.totalRecargos !== undefined) comanda.totalRecargos = actualizarComandaDto.totalRecargos;
      if (actualizarComandaDto.totalPrepago !== undefined) comanda.totalPrepago = actualizarComandaDto.totalPrepago;
      if (actualizarComandaDto.totalFinal !== undefined) comanda.totalFinal = actualizarComandaDto.totalFinal;
      if (actualizarComandaDto.precioDolar !== undefined) comanda.precioDolar = actualizarComandaDto.precioDolar;

      const comandaActualizada = await queryRunner.manager.save(Comanda, comanda);

      // Registrar en auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        descripcion: `Comanda ${comandaActualizada.numero} modificada`,
        datosAnteriores,
        datosNuevos: { comanda: comandaActualizada },
        observaciones: `Modificada por ${usuario.nombre}`,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      await queryRunner.commitTransaction();

      return await this.obtenerComanda(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async eliminarComanda(
    id: string,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const comanda = await this.obtenerComanda(id);

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Registrar en auditoría DENTRO de la transacción
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_ELIMINADA,
        modulo: ModuloSistema.COMANDA,
        descripcion: `Comanda ${comanda.numero} eliminada`,
        datosAnteriores: { comanda },
        observaciones: `Eliminada por ${usuario.nombre}`,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      // Soft delete
      await queryRunner.manager.softDelete(Comanda, id);

      // Commit de la transacción
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error eliminando comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async restaurarComanda(
    id: string,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comanda> {
    const comanda = await this.comandaRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!comanda) {
      throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
    }

    if (!comanda.deletedAt) {
      throw new BadRequestException('La comanda no está eliminada');
    }

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Restaurar comanda
      await queryRunner.manager.restore(Comanda, id);

      // Registrar en auditoría DENTRO de la transacción
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        descripcion: `Comanda ${comanda.numero} restaurada`,
        datosAnteriores: { deletedAt: comanda.deletedAt },
        datosNuevos: { comanda },
        observaciones: `Restaurada por ${usuario.nombre}`,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      // Commit de la transacción
      await queryRunner.commitTransaction();

      return await this.obtenerComanda(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error restaurando comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstadoComanda(
    id: string,
    nuevoEstado: EstadoComanda,
    usuario: Personal,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Comanda> {
    const comanda = await this.obtenerComanda(id);
    const estadoAnterior = comanda.estado;

    // Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      comanda.estado = nuevoEstado;
      const comandaActualizada = await queryRunner.manager.save(Comanda, comanda);

      // Registrar en auditoría DENTRO de la transacción
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        descripcion: `Estado de comanda ${comanda.numero} cambiado de ${estadoAnterior} a ${nuevoEstado}`,
        datosAnteriores: { estado: estadoAnterior },
        datosNuevos: { estado: nuevoEstado },
        observaciones: `Cambio de estado por ${usuario.nombre}`,
        ipAddress,
        userAgent,
        usuario,
      }, queryRunner.manager);

      // Commit de la transacción
      await queryRunner.commitTransaction();

      return comandaActualizada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error cambiando estado de comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private aplicarFiltros(queryBuilder: SelectQueryBuilder<Comanda>, filtros: Partial<FiltrarComandasDto>): void {
    if (filtros.numero) {
      queryBuilder.andWhere('comanda.numero = :numero', { numero: filtros.numero });
    }

    if (filtros.fechaInicio) {
      queryBuilder.andWhere('comanda.fecha >= :fechaInicio', { fechaInicio: filtros.fechaInicio });
    }

    if (filtros.fechaFin) {
      queryBuilder.andWhere('comanda.fecha <= :fechaFin', { fechaFin: filtros.fechaFin });
    }

    if (filtros.unidadNegocio) {
      queryBuilder.andWhere('comanda.unidadNegocio = :unidadNegocio', { unidadNegocio: filtros.unidadNegocio });
    }

    if (filtros.enCaja) {
      queryBuilder.andWhere('comanda.enCaja = :enCaja', { enCaja: filtros.enCaja });
    }

    if (filtros.clienteId) {
      queryBuilder.andWhere('cliente.id = :clienteId', { clienteId: filtros.clienteId });
    }

    if (filtros.personalPrincipalId) {
      queryBuilder.andWhere('personalPrincipal.id = :personalPrincipalId', { personalPrincipalId: filtros.personalPrincipalId });
    }

    if (filtros.estado) {
      queryBuilder.andWhere('comanda.estado = :estado', { estado: filtros.estado });
    }

    if (filtros.tipoId) {
      queryBuilder.andWhere('tipo.id = :tipoId', { tipoId: filtros.tipoId });
    }

    if (filtros.tipoItemId) {
      queryBuilder.andWhere(
        qb =>
          'EXISTS (SELECT 1 FROM item_comanda item WHERE item.comanda_id = comanda.id AND item.tipo_id = :tipoItemId)',
        { tipoItemId: filtros.tipoItemId },
      );
    }

    if (filtros.montoMinimo !== undefined) {
      queryBuilder.andWhere('comanda.totalFinal >= :montoMinimo', { montoMinimo: filtros.montoMinimo });
    }

    if (filtros.montoMaximo !== undefined) {
      queryBuilder.andWhere('comanda.totalFinal <= :montoMaximo', { montoMaximo: filtros.montoMaximo });
    }

    if (filtros.observaciones) {
      queryBuilder.andWhere('comanda.observaciones ILIKE :observaciones', { observaciones: `%${filtros.observaciones}%` });
    }
  }

  async exportarComandas(
    filtros: Partial<FiltrarComandasDto>,
    formato: 'csv' | 'pdf' | 'excel',
  ): Promise<{ data: Buffer | string; filename: string; contentType: string }> {
    // Obtener todas las comandas sin paginación para exportar
    const comandas = await this.obtenerComandasParaExportar(filtros);
    
    switch (formato) {
      case 'csv':
        return this.exportarCSV(comandas);
      case 'pdf':
        return this.exportarPDF(comandas);
      case 'excel':
        return this.exportarExcel(comandas);
      default:
        throw new BadRequestException('Formato de exportación no válido');
    }
  }

  private async obtenerComandasParaExportar(filtros: Partial<FiltrarComandasDto>): Promise<ComandaExportData[]> {
    if (Object.keys(filtros).length === 0) {
        throw new BadRequestException('No se proporcionaron filtros para la exportación');
    }
    
    const queryBuilder = this.comandaRepository
      .createQueryBuilder('comanda')
      .leftJoinAndSelect('comanda.cliente', 'cliente')
      .leftJoinAndSelect('comanda.personalPrincipal', 'personal')
      .leftJoinAndSelect('comanda.tipo', 'tipo')
      .leftJoinAndSelect('comanda.items', 'items')
      .leftJoinAndSelect('items.personal', 'itemPersonal')
      .leftJoinAndSelect('items.tipo', 'itemTipo')
      .where('comanda.deletedAt IS NULL');

    this.aplicarFiltros(queryBuilder, filtros);

    const comandas = await queryBuilder.getMany();

    return comandas.map(comanda => ({
      numero: comanda.numero,
      fecha: comanda.fecha.toLocaleDateString('es-AR'),
      cliente: comanda.cliente?.nombre || 'N/A',
      personal: comanda.personalPrincipal?.nombre || 'N/A',
      estado: comanda.estado,
      tipo: comanda.tipo?.nombre || 'N/A',
      subtotal: comanda.subtotal,
      totalDescuentos: comanda.totalDescuentos,
      totalRecargos: comanda.totalRecargos,
      totalFinal: comanda.totalFinal,
      observaciones: comanda.observaciones,
      items: comanda.items?.map(item => ({
        nombre: item.nombre,
        tipo: item.tipo?.nombre || 'N/A',
        precio: item.precio,
        cantidad: item.cantidad,
        descuento: item.descuento,
        subtotal: item.subtotal,
        personal: item.personal?.nombre || 'N/A',
      })) || [],
    }));
  }

  private async exportarCSV(comandas: ComandaExportData[]): Promise<{ data: string; filename: string; contentType: string }> {
    const headers = [
      'Número',
      'Fecha',
      'Cliente',
      'Personal',
      'Estado',
      'Tipo',
      'Subtotal',
      'Descuentos',
      'Recargos',
      'Total Final',
      'Observaciones',
    ];

    const csvContent = [
      headers.join(','),
      ...comandas.map(comanda => [
        `"${comanda.numero}"`,
        `"${comanda.fecha}"`,
        `"${comanda.cliente}"`,
        `"${comanda.personal}"`,
        `"${comanda.estado}"`,
        `"${comanda.tipo}"`,
        comanda.subtotal,
        comanda.totalDescuentos,
        comanda.totalRecargos,
        comanda.totalFinal,
        `"${comanda.observaciones || ''}"`,
      ].join(',')),
    ].join('\n');

    const filename = `comandas_${new Date().toISOString().split('T')[0]}.csv`;
    
    return {
      data: csvContent,
      filename,
      contentType: 'text/csv',
    };
  }

  private async exportarPDF(comandas: ComandaExportData[]): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const lineHeight = fontSize * 1.2;
    let y = height - 50;

    // Título
    page.drawText('Reporte de Comandas', {
      x: 50,
      y,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 30;

    // Fecha del reporte
    page.drawText(`Generado el: ${new Date().toLocaleDateString('es-AR')}`, {
      x: 50,
      y,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 30;

    // Tabla de comandas
    const headers = ['Número', 'Fecha', 'Cliente', 'Estado', 'Total'];
    const colWidths = [80, 80, 150, 80, 80];
    let x = 50;

    // Encabezados
    headers.forEach((header, index) => {
      page.drawText(header, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      x += colWidths[index];
    });
    y -= lineHeight;

    // Datos
    for (const comanda of comandas) {
      if (y < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }

      x = 50;
      page.drawText(comanda.numero, { x, y, size: fontSize, font });
      x += colWidths[0];
      
      page.drawText(comanda.fecha, { x, y, size: fontSize, font });
      x += colWidths[1];
      
      page.drawText(comanda.cliente.substring(0, 20), { x, y, size: fontSize, font });
      x += colWidths[2];
      
      page.drawText(comanda.estado, { x, y, size: fontSize, font });
      x += colWidths[3];
      
      page.drawText(`$${comanda.totalFinal.toFixed(2)}`, { x, y, size: fontSize, font });
      
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `comandas_${new Date().toISOString().split('T')[0]}.pdf`;
    
    return {
      data: Buffer.from(pdfBytes),
      filename,
      contentType: 'application/pdf',
    };
  }

  private async exportarExcel(comandas: ComandaExportData[]): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Comandas');

    // Estilos
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
      alignment: { horizontal: 'center' },
    };

    // Encabezados
    worksheet.columns = [
      { header: 'Número', key: 'numero', width: 15 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Personal', key: 'personal', width: 25 },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'Descuentos', key: 'totalDescuentos', width: 12 },
      { header: 'Recargos', key: 'totalRecargos', width: 12 },
      { header: 'Total Final', key: 'totalFinal', width: 12 },
      { header: 'Observaciones', key: 'observaciones', width: 40 },
    ];

    // Aplicar estilos a encabezados
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle as any;
    });

    // Agregar datos
    comandas.forEach(comanda => {
      worksheet.addRow({
        numero: comanda.numero,
        fecha: comanda.fecha,
        cliente: comanda.cliente,
        personal: comanda.personal,
        estado: comanda.estado,
        tipo: comanda.tipo,
        subtotal: comanda.subtotal,
        totalDescuentos: comanda.totalDescuentos,
        totalRecargos: comanda.totalRecargos,
        totalFinal: comanda.totalFinal,
        observaciones: comanda.observaciones || '',
      });
    });

    // Formatear columnas numéricas
    worksheet.getColumn('subtotal').numFmt = '$#,##0.00';
    worksheet.getColumn('totalDescuentos').numFmt = '$#,##0.00';
    worksheet.getColumn('totalRecargos').numFmt = '$#,##0.00';
    worksheet.getColumn('totalFinal').numFmt = '$#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `comandas_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return {
      data: Buffer.from(buffer),
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
