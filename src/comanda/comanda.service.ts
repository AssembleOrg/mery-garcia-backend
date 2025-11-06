import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  SelectQueryBuilder,
  In,
  Not,
  Between,
  Raw,
  IsNull,
  Or,
} from 'typeorm';
import { DateTime } from 'luxon';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  Comanda,
  EstadoDeComanda,
  TipoDeComanda,
} from './entities/Comanda.entity';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { MetodoPago } from 'src/cliente/entities/MetodoPago.entity';
import { CrearComandaDto } from './dto/crear-comanda.dto';
import { FiltrarComandasDto } from './dto/filtrar-comandas.dto';
import { FiltrarComisionesDto } from './dto/comisiones.dto';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { ItemComanda } from './entities/ItemComanda.entity';
import { Descuento } from './entities/descuento.entity';
import { ProductoServicio, TipoProductoServicio } from './entities/productoServicio.entity';
import { Caja } from 'src/enums/Caja.enum';
import { Egreso } from './entities/egreso.entity';
import { CrearEgresoDto } from './dto/crear-egreso.dto';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoItem } from './entities/TipoItem.entity';
import { TipoPago } from 'src/enums/TipoPago.enum';
import { Movimiento } from './entities/movimiento.entity';
import { ActualizarEgresoDto } from './dto/actualizar-egreso.dto';

export interface ComandasPaginadas {
  data: Comanda[];
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
export class ComandaService {
  private readonly logger = new Logger(ComandaService.name);

  constructor(
    @InjectRepository(Comanda)
    private comandaRepository: Repository<Comanda>,
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
    @InjectRepository(Trabajador)
    private trabajadorRepository: Repository<Trabajador>,
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
    @InjectRepository(MetodoPago)
    private metodoPagoRepository: Repository<MetodoPago>,
    @InjectRepository(PrepagoGuardado)
    private prepagoGuardadoRepository: Repository<PrepagoGuardado>,
    @InjectRepository(ItemComanda)
    private itemComandaRepository: Repository<ItemComanda>,
    @InjectRepository(Egreso)
    private egresoRepository: Repository<Egreso>,
    private dataSource: DataSource,
    private auditoriaService: AuditoriaService,
    @InjectRepository(Movimiento)
    private movimientoRepository: Repository<Movimiento>,
  ) { }

  async crear(crearComandaDto: CrearComandaDto): Promise<Comanda> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let comanda = new Comanda();
      comanda.numero = crearComandaDto.numero;
      comanda.tipoDeComanda = crearComandaDto.tipoDeComanda;
      comanda.estadoDeComanda = crearComandaDto.estadoDeComanda;
      comanda.caja = crearComandaDto.caja;
      comanda.precioDolar = crearComandaDto.precioDolar;
      comanda.precioPesos = crearComandaDto.precioPesos;
      comanda.valorDolar = crearComandaDto.valorDolar;
      comanda.observaciones = crearComandaDto.observaciones;
      comanda.createdAt = crearComandaDto.createdAt;
      comanda.usuarioConsumePrepagoARS =
        crearComandaDto.usuarioConsumePrepagoARS;
      comanda.usuarioConsumePrepagoUSD =
        crearComandaDto.usuarioConsumePrepagoUSD;

      // Persistir los IDs de prepagos si se proporcionan
      if (crearComandaDto.prepagoARSID) {
        comanda.prepagoARSID = crearComandaDto.prepagoARSID;
      }
      if (crearComandaDto.prepagoUSDID) {
        comanda.prepagoUSDID = crearComandaDto.prepagoUSDID;
      }

      if (crearComandaDto.clienteId) {
        const cliente = await queryRunner.manager.findOne(Cliente, {
          where: { id: crearComandaDto.clienteId },
        });
        if (!cliente) {
          throw new NotFoundException(`Cliente no encontrado`);
        }

        // Manejar prepagos usando los IDs específicos
        if (
          crearComandaDto.usuarioConsumePrepagoARS &&
          crearComandaDto.prepagoARSID
        ) {
          const prepago = await queryRunner.manager.findOne(PrepagoGuardado, {
            where: {
              id: crearComandaDto.prepagoARSID,
              cliente: { id: crearComandaDto.clienteId },
              estado: EstadoPrepago.ACTIVA,
              moneda: TipoMoneda.ARS,
            },
          });
          if (!prepago) {
            throw new NotFoundException(
              `La seña ARS especificada no está disponible`,
            );
          }
          prepago.estado = EstadoPrepago.UTILIZADA;
          await queryRunner.manager.save(PrepagoGuardado, prepago);
        }

        if (
          crearComandaDto.usuarioConsumePrepagoUSD &&
          crearComandaDto.prepagoUSDID
        ) {
          const prepago = await queryRunner.manager.findOne(PrepagoGuardado, {
            where: {
              id: crearComandaDto.prepagoUSDID,
              cliente: { id: crearComandaDto.clienteId },
              estado: EstadoPrepago.ACTIVA,
              moneda: TipoMoneda.USD,
            },
          });
          if (!prepago) {
            throw new NotFoundException(
              `La seña USD especificada no está disponible`,
            );
          }
          prepago.estado = EstadoPrepago.UTILIZADA;
          await queryRunner.manager.save(PrepagoGuardado, prepago);
        }

        comanda.cliente = cliente;
      }

      if (crearComandaDto.creadoPorId) {
        const creadoPor = await queryRunner.manager.findOne(Personal, {
          where: { id: crearComandaDto.creadoPorId },
        });
        if (!creadoPor) {
          throw new NotFoundException(`Personal no encontrado`);
        }
        comanda.creadoPor = creadoPor;
      }

      comanda = await queryRunner.manager.save(Comanda, comanda);

      if (crearComandaDto.items && crearComandaDto.items.length > 0) {
        const items = crearComandaDto.items.map(async (itemDto) => {
          const item = new ItemComanda();
          item.nombre = itemDto.nombre;
          item.precio = itemDto.precio;
          item.cantidad = itemDto.cantidad;
          item.descuento = itemDto.descuento ?? 0;
          item.subtotal = itemDto.subtotal ?? itemDto.precio * itemDto.cantidad;
          item.comanda = comanda;

          if (itemDto.productoServicioId) {
            item.productoServicio = {
              id: itemDto.productoServicioId,
            } as ProductoServicio;
          }

          if (itemDto.trabajadorId) {
            item.trabajador = { id: itemDto.trabajadorId } as Trabajador;
          }

          if (itemDto.tipoId) {
            item.tipo = { id: itemDto.tipoId } as TipoItem;
          }

          const itemGuardado = await queryRunner.manager.save(
            ItemComanda,
            item,
          );

          // Crear métodos de pago para este item si se proporcionan
          if (itemDto.metodosPago && itemDto.metodosPago.length > 0) {
            const metodosPago = itemDto.metodosPago.map((metodoPago) => {
              const metodoPagoItem = new MetodoPago();
              metodoPagoItem.tipo = metodoPago.tipo;
              metodoPagoItem.monto = metodoPago.monto;
              metodoPagoItem.montoFinal = metodoPago.montoFinal;
              metodoPagoItem.descuentoGlobalPorcentaje =
                metodoPago.descuentoGlobalPorcentaje;
              metodoPagoItem.moneda = metodoPago.moneda;
              metodoPagoItem.recargoPorcentaje =
                metodoPago.recargoPorcentaje ?? 0;
              metodoPagoItem.itemComanda = itemGuardado;
              return queryRunner.manager.save(MetodoPago, metodoPagoItem);
            });

            await Promise.all(metodosPago);
          }

          return itemGuardado;
        });

        comanda.items = await Promise.all(items);
      }

      // Crear métodos de pago para la comanda si se proporcionan
      if (crearComandaDto.metodosPago && crearComandaDto.metodosPago.length > 0) {
        const metodosPago = crearComandaDto.metodosPago.map((metodoPago) => {
          const metodoPagoComanda = new MetodoPago();
          metodoPagoComanda.tipo = metodoPago.tipo;
          metodoPagoComanda.monto = metodoPago.monto;
          metodoPagoComanda.montoFinal = metodoPago.montoFinal;
          metodoPagoComanda.descuentoGlobalPorcentaje =
            metodoPago.descuentoGlobalPorcentaje;
          metodoPagoComanda.moneda = metodoPago.moneda;
          metodoPagoComanda.recargoPorcentaje = metodoPago.recargoPorcentaje ?? 0;
          metodoPagoComanda.comanda = comanda;
          return queryRunner.manager.save(MetodoPago, metodoPagoComanda);
        });

        comanda.metodosPago = await Promise.all(metodosPago);
      }

      if (
        crearComandaDto.descuentosAplicados &&
        crearComandaDto.descuentosAplicados.length > 0
      ) {
        const descuentos = crearComandaDto.descuentosAplicados.map(
          (descuentoDto) => {
            const descuento = new Descuento();
            descuento.nombre = descuentoDto.nombre;
            descuento.descripcion = descuentoDto.descripcion;
            descuento.porcentaje = descuentoDto.porcentaje;
            descuento.montoFijo = descuentoDto.montoFijo;
            descuento.comanda = comanda;
            return queryRunner.manager.save(Descuento, descuento);
          },
        );

        comanda.descuentosAplicados = await Promise.all(descuentos);
      }

      await queryRunner.commitTransaction();

      return await this.obtenerPorId(comanda.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async eliminarHard(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener la comanda con todas sus relaciones necesarias
      const comanda = await queryRunner.manager.findOne(Comanda, {
        where: { id },
        relations: [
          'prepagoARS',
          'prepagoUSD',
          'items',
          'metodosPago',
          'items.metodosPago',
          'descuentosAplicados',
          'egresos',
        ],
      });

      if (!comanda) {
        throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
      }

      // Reactivar prepagos si estaban utilizados por esta comanda
      if (comanda.prepagoARSID && comanda.prepagoARS) {
        if (comanda.prepagoARS.estado === EstadoPrepago.UTILIZADA) {
          comanda.prepagoARS.estado = EstadoPrepago.ACTIVA;
          await queryRunner.manager.save(PrepagoGuardado, comanda.prepagoARS);
        }
      }

      if (comanda.prepagoUSDID && comanda.prepagoUSD) {
        if (comanda.prepagoUSD.estado === EstadoPrepago.UTILIZADA) {
          comanda.prepagoUSD.estado = EstadoPrepago.ACTIVA;
          await queryRunner.manager.save(PrepagoGuardado, comanda.prepagoUSD);
        }
      }

      // Eliminar en orden correcto para evitar violaciones de FK
      // 1. Primero los métodos de pago de los items
      if (comanda.items && comanda.items.length > 0) {
        for (const item of comanda.items) {
          if (item.metodosPago && item.metodosPago.length > 0) {
            await queryRunner.manager.remove(MetodoPago, item.metodosPago);
          }
        }
      }

      // 2. Luego los items de la comanda
      if (comanda.items && comanda.items.length > 0) {
        await queryRunner.manager.remove(ItemComanda, comanda.items);
      }

      // 3. Luego los descuentos
      if (
        comanda.descuentosAplicados &&
        comanda.descuentosAplicados.length > 0
      ) {
        await queryRunner.manager.remove(
          Descuento,
          comanda.descuentosAplicados,
        );
      }

      // 4. Luego los egresos
      if (comanda.egresos && comanda.egresos.length > 0) {
        await queryRunner.manager.remove(Egreso, comanda.egresos);
      }

      // 5. Finalmente la comanda
      await queryRunner.manager.remove(Comanda, comanda);

      await queryRunner.commitTransaction();

      this.logger.log(`Comanda eliminada permanentemente: ${id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error eliminando comanda permanentemente: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async existeComanda(numero: string): Promise<boolean> {
    const comanda = await this.comandaRepository.findOne({
      where: { numero },
    });
    return !!comanda;
  }

  async obtenerTodos(): Promise<Comanda[]> {
    return await this.comandaRepository.find({
      relations: [
        'cliente',
        'creadoPor',
        'metodosPago',
        'items',
        'items.metodosPago',
        'items.productoServicio',
        'items.trabajador',
        'descuentosAplicados',
        'items.productoServicio.unidadNegocio',
        'prepagoARS',
        'prepagoUSD',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async obtenerConPaginacion(
    filtros: FiltrarComandasDto,
  ): Promise<ComandasPaginadas> {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = 'createdAt',
      order = 'DESC',
    } = filtros;
    const skip = (page - 1) * limit;

    const queryBuilder = this.comandaRepository
      .createQueryBuilder('comanda')
      .leftJoinAndSelect('comanda.cliente', 'cliente')
      .leftJoinAndSelect('cliente.prepagosGuardados', 'prepagosGuardados')
      .leftJoinAndSelect('comanda.creadoPor', 'creadoPor')
      .leftJoinAndSelect('comanda.metodosPago', 'metodosPago')
      .leftJoinAndSelect('comanda.items', 'items')
      .leftJoinAndSelect('items.productoServicio', 'productoServicio')
      .leftJoinAndSelect('items.tipo', 'tipo')
      .leftJoinAndSelect('items.trabajador', 'trabajador')
      .leftJoinAndSelect('productoServicio.unidadNegocio', 'unidadNegocio')
      .leftJoinAndSelect('comanda.prepagoARS', 'prepagoARS')
      .leftJoinAndSelect('comanda.prepagoUSD', 'prepagoUSD');

    console.log(filtros.incluirTraspasadas, filtros);
    // Lógica para excluir TRASPASADAS:
    // 1. Si explícitamente NO se quieren incluir Y NO hay filtro específico de estado
    // 2. Si es tipo INGRESO y NO hay filtro específico de estado (comportamiento por defecto)
    if (
      (!filtros.incluirTraspasadas && !filtros.estadoDeComanda) ||
      (filtros.tipoDeComanda === TipoDeComanda.INGRESO &&
        !filtros.estadoDeComanda)
    ) {
      queryBuilder.andWhere('comanda.estadoDeComanda != :estado', {
        estado: EstadoDeComanda.TRASPASADA,
      });
    }

    if (filtros.tipoDeComanda === TipoDeComanda.EGRESO) {
      queryBuilder.leftJoinAndSelect('comanda.egresos', 'egresos');
    }

    if (filtros.fechaDesde && filtros.fechaHasta) {
      const fechaDesde = new Date(filtros.fechaDesde);
      const fechaHasta = new Date(filtros.fechaHasta);
      fechaDesde.setUTCHours(0, 0, 0, 0);
      fechaHasta.setUTCHours(23, 59, 59, 999);
      fechaHasta.setDate(fechaHasta.getDate() - 1);
      queryBuilder.andWhere('comanda.createdAt >= :fechaDesde', { fechaDesde });
      queryBuilder.andWhere('comanda.createdAt < :fechaHasta', { fechaHasta });
    }

    // Aplicar filtros
    this.aplicarFiltros(queryBuilder, filtros);

    // Aplicar ordenamiento
    const camposPermitidos = [
      'createdAt',
      'numero',
      'tipoDeComanda',
      'estadoDeComanda',
    ];
    const campoOrdenamiento = camposPermitidos.includes(orderBy)
      ? orderBy
      : 'createdAt';
    queryBuilder.orderBy(
      `comanda.${campoOrdenamiento}`,
      order as 'ASC' | 'DESC',
    );

    const [comandas, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    let newComandas: Comanda[] = [];

    if (filtros.servicioId && filtros.unidadNegocioId) {
      for (const comanda of comandas) {
        const productosServicio = comanda.items.filter(
          (item) =>
            item.productoServicio.unidadNegocio.id ===
            filtros.unidadNegocioId &&
            item.productoServicio.id === filtros.servicioId,
        );
        //!Realmente no se si es necesario hacer esto, porque ya se filtra por servicio y unidadNegocio en el queryBuilder
        //!Pero sirve para evitar errores en el frontend
        if (productosServicio.length > 0) {
          newComandas.push(comanda);
        } else {
          throw new NotFoundException(
            `No se encontró el servicio con las condiciones especificadas`,
          );
        }
      }
    }

    if (filtros.unidadNegocioId && !filtros.servicioId) {
      for (const comanda of comandas) {
        const productosServicio = comanda.items.filter(
          (item) =>
            item.productoServicio.unidadNegocio.id === filtros.unidadNegocioId,
        );
        if (productosServicio.length > 0) {
          newComandas.push(comanda);
        } else {
          throw new NotFoundException(
            `No se encontró el servicio con las condiciones especificadas`,
          );
        }
      }
    }

    return {
      data: newComandas.length > 0 ? newComandas : comandas,
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

  async obtenerPorId(id: string): Promise<Comanda> {
    const comanda = await this.comandaRepository.findOne({
      where: { id },
      relations: [
        'cliente',
        'cliente.prepagosGuardados',
        'creadoPor',
        'metodosPago',
        'items.metodosPago',
        'items',
        'items.productoServicio',
        'items.trabajador',
        'descuentosAplicados',
        'egresos',
        'prepagoARS',
        'prepagoUSD',
      ],
    });
    if (!comanda) {
      throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
    }
    if (comanda.cliente) {
      comanda.cliente.prepagosGuardados =
        comanda.cliente.prepagosGuardados.filter(
          (pg) => pg.estado === EstadoPrepago.ACTIVA,
        );
    }
    return comanda;
  }
  // async resumenCajaChica(): Promise<{
  //   usd: number;
  //   pesos: number;
  // }> {
  //   const comandas = await this.comandaRepository.find({
  //     where: { estadoDeComanda: In([EstadoDeComanda.VALIDADO, EstadoDeComanda.PENDIENTE, EstadoDeComanda.FINALIZADA]) },
  //     select
  //   });
  //   const totalUsd = comandas.reduce((acc, comanda) => acc + comanda.valorDolar, 0);
  //   const totalPesos = comandas.reduce((acc, comanda) => acc + comanda.precioPesos, 0);
  //   return {
  //     usd: totalUsd,
  //     pesos: totalPesos,
  //   };
  // }

  async actualizar(
    id: string,
    actualizarComandaDto: Partial<CrearComandaDto>,
  ): Promise<Comanda> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que la comanda existe
      const comanda = await queryRunner.manager.findOne(Comanda, {
        where: { id },
        relations: [
          'cliente',
          'cliente.prepagosGuardados',
          'creadoPor',
          'items',
          'metodosPago',
          'items.metodosPago',
          'items.productoServicio',
          'items.trabajador',
          'descuentosAplicados',
        ],
      });

      if (!comanda) {
        throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
      }

      // 1. Actualizar campos básicos de la comanda solo si existen en el DTO
      if (actualizarComandaDto.numero !== undefined) {
        comanda.numero = actualizarComandaDto.numero;
      }
      if (actualizarComandaDto.tipoDeComanda !== undefined) {
        comanda.tipoDeComanda = actualizarComandaDto.tipoDeComanda;
      }
      if (actualizarComandaDto.estadoDeComanda !== undefined) {
        comanda.estadoDeComanda = actualizarComandaDto.estadoDeComanda;
      }
      if (actualizarComandaDto.caja !== undefined) {
        comanda.caja = actualizarComandaDto.caja;
      }
      if (actualizarComandaDto.precioDolar !== undefined) {
        comanda.precioDolar = actualizarComandaDto.precioDolar;
      }
      if (actualizarComandaDto.precioPesos !== undefined) {
        comanda.precioPesos = actualizarComandaDto.precioPesos;
      }
      if (actualizarComandaDto.valorDolar !== undefined) {
        comanda.valorDolar = actualizarComandaDto.valorDolar;
      }
      if (actualizarComandaDto.observaciones !== undefined) {
        comanda.observaciones = actualizarComandaDto.observaciones;
      }
      if (actualizarComandaDto.usuarioConsumePrepagoARS !== undefined) {
        comanda.usuarioConsumePrepagoARS =
          actualizarComandaDto.usuarioConsumePrepagoARS;
      }
      if (actualizarComandaDto.usuarioConsumePrepagoUSD !== undefined) {
        comanda.usuarioConsumePrepagoUSD =
          actualizarComandaDto.usuarioConsumePrepagoUSD;
      }

      // Actualizar createdAt si se proporciona
      if (actualizarComandaDto.createdAt !== undefined) {
        comanda.createdAt = actualizarComandaDto.createdAt;
      }

      // 2. Actualizar cliente solo si se proporciona
      if (actualizarComandaDto.clienteId !== undefined) {
        const clienteAnterior = comanda.cliente;

        if (actualizarComandaDto.clienteId) {
          const cliente = await queryRunner.manager.findOne(Cliente, {
            where: { id: actualizarComandaDto.clienteId },
          });
          if (!cliente) {
            throw new NotFoundException(`Cliente no encontrado`);
          }

          // Si hay cambio de cliente, manejar prepagos
          if (
            clienteAnterior &&
            clienteAnterior.id !== actualizarComandaDto.clienteId
          ) {
            // Reactivar prepagos del cliente anterior si los había
            if (comanda.prepagoARSID) {
              const prepagoAnteriorARS = await queryRunner.manager.findOne(
                PrepagoGuardado,
                {
                  where: { id: comanda.prepagoARSID },
                },
              );
              if (
                prepagoAnteriorARS &&
                prepagoAnteriorARS.estado === EstadoPrepago.UTILIZADA
              ) {
                prepagoAnteriorARS.estado = EstadoPrepago.ACTIVA;
                await queryRunner.manager.save(
                  PrepagoGuardado,
                  prepagoAnteriorARS,
                );
              }
            }

            if (comanda.prepagoUSDID) {
              const prepagoAnteriorUSD = await queryRunner.manager.findOne(
                PrepagoGuardado,
                {
                  where: { id: comanda.prepagoUSDID },
                },
              );
              if (
                prepagoAnteriorUSD &&
                prepagoAnteriorUSD.estado === EstadoPrepago.UTILIZADA
              ) {
                prepagoAnteriorUSD.estado = EstadoPrepago.ACTIVA;
                await queryRunner.manager.save(
                  PrepagoGuardado,
                  prepagoAnteriorUSD,
                );
              }
            }

            // Limpiar IDs de prepagos antiguos
            comanda.prepagoARSID = undefined;
            comanda.prepagoUSDID = undefined;
          }

          // Mismo cliente - no hacer nada con prepagos aquí, se maneja después

          comanda.cliente = cliente;
        } else {
          // Si se está removiendo el cliente, reactivar prepagos si los había
          if (clienteAnterior) {
            if (comanda.prepagoARSID) {
              const prepagoAnteriorARS = await queryRunner.manager.findOne(
                PrepagoGuardado,
                {
                  where: { id: comanda.prepagoARSID },
                },
              );
              if (
                prepagoAnteriorARS &&
                prepagoAnteriorARS.estado === EstadoPrepago.UTILIZADA
              ) {
                prepagoAnteriorARS.estado = EstadoPrepago.ACTIVA;
                await queryRunner.manager.save(
                  PrepagoGuardado,
                  prepagoAnteriorARS,
                );
              }
            }

            if (comanda.prepagoUSDID) {
              const prepagoAnteriorUSD = await queryRunner.manager.findOne(
                PrepagoGuardado,
                {
                  where: { id: comanda.prepagoUSDID },
                },
              );
              if (
                prepagoAnteriorUSD &&
                prepagoAnteriorUSD.estado === EstadoPrepago.UTILIZADA
              ) {
                prepagoAnteriorUSD.estado = EstadoPrepago.ACTIVA;
                await queryRunner.manager.save(
                  PrepagoGuardado,
                  prepagoAnteriorUSD,
                );
              }
            }
          }

          comanda.cliente = undefined;
          comanda.prepagoARSID = undefined;
          comanda.prepagoUSDID = undefined;
        }
      }

      // LÓGICA UNIFICADA DE MANEJO DE PREPAGOS
      // 1. Si se cancela el consumo de prepago ARS
      if (actualizarComandaDto.usuarioConsumePrepagoARS === false) {
        const prevARSId = comanda.prepagoARSID;
        if (prevARSId) {
          const prepagoARS = await queryRunner.manager.findOne(
            PrepagoGuardado,
            {
              where: { id: prevARSId },
            },
          );
          if (prepagoARS && prepagoARS.estado === EstadoPrepago.UTILIZADA) {
            prepagoARS.estado = EstadoPrepago.ACTIVA;
            await queryRunner.manager.save(PrepagoGuardado, prepagoARS);
          }
        }
        // Limpiar siempre
        comanda.prepagoARSID = undefined;
        comanda.prepagoARS = undefined;
        await queryRunner.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({ prepagoARSID: null })
          .where('id = :id', { id: comanda.id })
          .execute();
        this.logger.debug(`prepagoARSID NULL for comanda ${comanda.id}`);
      }

      // 2. Si se cancela el consumo de prepago USD
      if (actualizarComandaDto.usuarioConsumePrepagoUSD === false) {
        const prevUSDId = comanda.prepagoUSDID;
        if (prevUSDId) {
          const prepagoUSD = await queryRunner.manager.findOne(
            PrepagoGuardado,
            {
              where: { id: prevUSDId },
            },
          );
          if (prepagoUSD && prepagoUSD.estado === EstadoPrepago.UTILIZADA) {
            prepagoUSD.estado = EstadoPrepago.ACTIVA;
            await queryRunner.manager.save(PrepagoGuardado, prepagoUSD);
          }
        }
        // Limpiar siempre
        comanda.prepagoUSDID = undefined;
        comanda.prepagoUSD = undefined;
        await queryRunner.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({ prepagoUSDID: null })
          .where('id = :id', { id: comanda.id })
          .execute();
        this.logger.debug(`prepagoUSDID NULL for comanda ${comanda.id}`);
      }

      // 2.1. Actualizar prepagos si se proporcionan nuevos IDs
      // Solo procesar prepagoARSID si se proporciona EXPLÍCITAMENTE en el DTO
      if (actualizarComandaDto.prepagoARSID !== undefined) {
        console.log(
          '🔍 Procesando prepagoARSID del DTO:',
          actualizarComandaDto.prepagoARSID,
        );
        if (
          actualizarComandaDto.prepagoARSID === null ||
          actualizarComandaDto.prepagoARSID === ''
        ) {
          // Si se establece explícitamente como null o vacío, reactivar el prepago anterior
          if (comanda.prepagoARSID) {
            const prepagoAnterior = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: { id: comanda.prepagoARSID },
              },
            );
            if (
              prepagoAnterior &&
              prepagoAnterior.estado === EstadoPrepago.UTILIZADA
            ) {
              prepagoAnterior.estado = EstadoPrepago.ACTIVA;
              await queryRunner.manager.save(PrepagoGuardado, prepagoAnterior);
            }
          }
          comanda.prepagoARSID = undefined;
          console.log(
            '✅ Prepago ARS ID establecido como undefined por DTO null/vacío',
          );
        } else if (actualizarComandaDto.prepagoARSID) {
          // Solo si se proporciona un ID válido (no undefined, null, o vacío)
          console.log(
            '🔄 Asignando nuevo prepago ARS:',
            actualizarComandaDto.prepagoARSID,
          );
          // Si había un prepago anterior diferente, reactivarlo
          if (
            comanda.prepagoARSID &&
            comanda.prepagoARSID !== actualizarComandaDto.prepagoARSID
          ) {
            const prepagoAnterior = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: { id: comanda.prepagoARSID },
              },
            );
            if (
              prepagoAnterior &&
              prepagoAnterior.estado === EstadoPrepago.UTILIZADA
            ) {
              prepagoAnterior.estado = EstadoPrepago.ACTIVA;
              await queryRunner.manager.save(PrepagoGuardado, prepagoAnterior);
            }
          }

          // Actualizar con el nuevo prepago
          comanda.prepagoARSID = actualizarComandaDto.prepagoARSID;
          console.log('✅ Prepago ARS ID asignado:', comanda.prepagoARSID);

          // Marcar el nuevo prepago como utilizado si existe
          if (comanda.cliente) {
            const nuevoPrepago = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: {
                  id: actualizarComandaDto.prepagoARSID,
                  cliente: { id: comanda.cliente.id },
                  estado: EstadoPrepago.ACTIVA,
                  moneda: TipoMoneda.ARS,
                },
              },
            );
            if (nuevoPrepago) {
              nuevoPrepago.estado = EstadoPrepago.UTILIZADA;
              await queryRunner.manager.save(PrepagoGuardado, nuevoPrepago);
            }
          }
        }
        // Si actualizarComandaDto.prepagoARSID es undefined, NO hacer nada
        // (esto permite que la lógica de usuarioConsumePrepagoARS funcione correctamente)
      } else {
        console.log('ℹ️ No se procesa prepagoARSID - DTO es undefined');
      }

      // Solo procesar prepagoUSDID si se proporciona EXPLÍCITAMENTE en el DTO
      if (actualizarComandaDto.prepagoUSDID !== undefined) {
        console.log(
          '🔍 Procesando prepagoUSDID del DTO:',
          actualizarComandaDto.prepagoUSDID,
        );
        if (
          actualizarComandaDto.prepagoUSDID === null ||
          actualizarComandaDto.prepagoUSDID === ''
        ) {
          // Si se establece explícitamente como null o vacío, reactivar el prepago anterior
          if (comanda.prepagoUSDID) {
            const prepagoAnterior = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: { id: comanda.prepagoUSDID },
              },
            );
            if (
              prepagoAnterior &&
              prepagoAnterior.estado === EstadoPrepago.UTILIZADA
            ) {
              prepagoAnterior.estado = EstadoPrepago.ACTIVA;
              await queryRunner.manager.save(PrepagoGuardado, prepagoAnterior);
            }
          }
          comanda.prepagoUSDID = undefined;
          console.log(
            '✅ Prepago USD ID establecido como undefined por DTO null/vacío',
          );
        } else if (actualizarComandaDto.prepagoUSDID) {
          // Solo si se proporciona un ID válido (no undefined, null, o vacío)
          console.log(
            '🔄 Asignando nuevo prepago USD:',
            actualizarComandaDto.prepagoUSDID,
          );
          // Si había un prepago anterior diferente, reactivarlo
          if (
            comanda.prepagoUSDID &&
            comanda.prepagoUSDID !== actualizarComandaDto.prepagoUSDID
          ) {
            const prepagoAnterior = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: { id: comanda.prepagoUSDID },
              },
            );
            if (
              prepagoAnterior &&
              prepagoAnterior.estado === EstadoPrepago.UTILIZADA
            ) {
              prepagoAnterior.estado = EstadoPrepago.ACTIVA;
              await queryRunner.manager.save(PrepagoGuardado, prepagoAnterior);
            }
          }

          // Actualizar con el nuevo prepago
          comanda.prepagoUSDID = actualizarComandaDto.prepagoUSDID;
          console.log('✅ Prepago USD ID asignado:', comanda.prepagoUSDID);

          // Marcar el nuevo prepago como utilizado si existe
          if (comanda.cliente) {
            const nuevoPrepago = await queryRunner.manager.findOne(
              PrepagoGuardado,
              {
                where: {
                  id: actualizarComandaDto.prepagoUSDID,
                  cliente: { id: comanda.cliente.id },
                  estado: EstadoPrepago.ACTIVA,
                  moneda: TipoMoneda.USD,
                },
              },
            );
            if (nuevoPrepago) {
              nuevoPrepago.estado = EstadoPrepago.UTILIZADA;
              await queryRunner.manager.save(PrepagoGuardado, nuevoPrepago);
            }
          }
        }
        // Si actualizarComandaDto.prepagoUSDID es undefined, NO hacer nada
        // (esto permite que la lógica de usuarioConsumePrepagoUSD funcione correctamente)
      } else {
        console.log('ℹ️ No se procesa prepagoUSDID - DTO es undefined');
      }

      // 3. Actualizar creadoPor solo si se proporciona
      if (actualizarComandaDto.creadoPorId !== undefined) {
        const creadoPor = await queryRunner.manager.findOne(Personal, {
          where: { id: actualizarComandaDto.creadoPorId },
        });
        if (!creadoPor) {
          throw new NotFoundException(`Personal no encontrado`);
        }
        comanda.creadoPor = creadoPor;
      }

      // 4. Manejar prepago si se consume - ESTA LÓGICA YA NO ES NECESARIA
      // (Se maneja arriba con los IDs específicos)

      // 5. Actualizar items solo si se proporcionan
      if (actualizarComandaDto.items !== undefined) {
        // Eliminar items existentes
        if (comanda.items && comanda.items.length > 0) {
          await queryRunner.manager.remove(ItemComanda, comanda.items);
        }

        // Crear nuevos items si se proporcionan
        if (
          actualizarComandaDto.items &&
          actualizarComandaDto.items.length > 0
        ) {
          const items = actualizarComandaDto.items.map(async (itemDto) => {
            const item = new ItemComanda();
            item.nombre = itemDto.nombre;
            item.precio = itemDto.precio;
            item.cantidad = itemDto.cantidad;
            item.descuento = itemDto.descuento ?? 0;
            item.subtotal =
              itemDto.subtotal ?? itemDto.precio * itemDto.cantidad;
            item.comanda = comanda;

            if (itemDto.productoServicioId) {
              item.productoServicio = {
                id: itemDto.productoServicioId,
              } as ProductoServicio;
            }

            if (itemDto.trabajadorId) {
              item.trabajador = { id: itemDto.trabajadorId } as Trabajador;
            }

            if (itemDto.tipoId) {
              item.tipo = { id: itemDto.tipoId } as TipoItem;
            }

            const itemGuardado = await queryRunner.manager.save(
              ItemComanda,
              item,
            );

            // Crear métodos de pago para este item si se proporcionan
            if (itemDto.metodosPago && itemDto.metodosPago.length > 0) {
              const metodosPago = itemDto.metodosPago.map((metodoPago) => {
                const metodoPagoItem = new MetodoPago();
                metodoPagoItem.tipo = metodoPago.tipo;
                metodoPagoItem.monto = metodoPago.monto;
                metodoPagoItem.montoFinal = metodoPago.montoFinal;
                metodoPagoItem.descuentoGlobalPorcentaje =
                  metodoPago.descuentoGlobalPorcentaje;
                metodoPagoItem.moneda = metodoPago.moneda;
                metodoPagoItem.recargoPorcentaje =
                  metodoPago.recargoPorcentaje ?? 0;
                metodoPagoItem.itemComanda = itemGuardado;
                return queryRunner.manager.save(MetodoPago, metodoPagoItem);
              });

              await Promise.all(metodosPago);
            }

            return itemGuardado;
          });

          comanda.items = await Promise.all(items);
        }
      }

      // 6. Actualizar métodos de pago de la comanda solo si se proporcionan
      if (actualizarComandaDto.metodosPago !== undefined) {
        // Eliminar métodos de pago existentes de la comanda
        if (comanda.metodosPago && comanda.metodosPago.length > 0) {
          await queryRunner.manager.remove(MetodoPago, comanda.metodosPago);
        }

        // Crear nuevos métodos de pago si se proporcionan
        if (
          actualizarComandaDto.metodosPago &&
          actualizarComandaDto.metodosPago.length > 0
        ) {
          const metodosPago = actualizarComandaDto.metodosPago.map(
            (metodoPago) => {
              const metodoPagoComanda = new MetodoPago();
              metodoPagoComanda.tipo = metodoPago.tipo;
              metodoPagoComanda.monto = metodoPago.monto;
              metodoPagoComanda.montoFinal = metodoPago.montoFinal;
              metodoPagoComanda.descuentoGlobalPorcentaje =
                metodoPago.descuentoGlobalPorcentaje;
              metodoPagoComanda.moneda = metodoPago.moneda;
              metodoPagoComanda.recargoPorcentaje =
                metodoPago.recargoPorcentaje ?? 0;
              metodoPagoComanda.comanda = comanda;
              return queryRunner.manager.save(MetodoPago, metodoPagoComanda);
            },
          );

          comanda.metodosPago = await Promise.all(metodosPago);
        }
      }

      // 7. Actualizar descuentos solo si se proporcionan
      if (actualizarComandaDto.descuentosAplicados !== undefined) {
        // Eliminar descuentos existentes
        if (
          comanda.descuentosAplicados &&
          comanda.descuentosAplicados.length > 0
        ) {
          await queryRunner.manager.remove(
            Descuento,
            comanda.descuentosAplicados,
          );
        }

        // Crear nuevos descuentos si se proporcionan
        if (
          actualizarComandaDto.descuentosAplicados &&
          actualizarComandaDto.descuentosAplicados.length > 0
        ) {
          const descuentos = actualizarComandaDto.descuentosAplicados.map(
            (descuentoDto) => {
              const descuento = new Descuento();
              descuento.nombre = descuentoDto.nombre;
              descuento.descripcion = descuentoDto.descripcion;
              descuento.porcentaje = descuentoDto.porcentaje;
              descuento.montoFijo = descuentoDto.montoFijo;
              descuento.comanda = comanda;
              return queryRunner.manager.save(Descuento, descuento);
            },
          );

          comanda.descuentosAplicados = await Promise.all(descuentos);
        }
      }

      // Logs de debug antes de guardar
      console.log('🔍 Antes de guardar - prepagoARSID:', comanda.prepagoARSID);
      console.log('🔍 Antes de guardar - prepagoUSDID:', comanda.prepagoUSDID);
      console.log(
        '🔍 Antes de guardar - usuarioConsumePrepagoARS:',
        comanda.usuarioConsumePrepagoARS,
      );
      console.log(
        '🔍 Antes de guardar - usuarioConsumePrepagoUSD:',
        comanda.usuarioConsumePrepagoUSD,
      );

      // 8. Guardar la comanda actualizada
      const comandaActualizada = await queryRunner.manager.save(
        Comanda,
        comanda,
      );

      // 8.1. Enforzar en BD que los prepagos queden en NULL si los flags son false
      if (comanda.usuarioConsumePrepagoARS === false) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({ prepagoARSID: () => 'NULL' })
          .where('id = :id', { id: comandaActualizada.id })
          .execute();
      }
      if (comanda.usuarioConsumePrepagoUSD === false) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(Comanda)
          .set({ prepagoUSDID: () => 'NULL' })
          .where('id = :id', { id: comandaActualizada.id })
          .execute();
      }

      // 8.2. CORRECCIÓN: Si los flags están en true y hay prepagos asignados, marcarlos como UTILIZADO
      // Esto maneja el caso donde el prepago ya estaba asignado y solo cambió el flag
      if (comanda.usuarioConsumePrepagoARS === true && comanda.prepagoARSID) {
        const prepagoARS = await queryRunner.manager.findOne(PrepagoGuardado, {
          where: { id: comanda.prepagoARSID },
        });
        if (prepagoARS && prepagoARS.estado === EstadoPrepago.ACTIVA) {
          prepagoARS.estado = EstadoPrepago.UTILIZADA;
          await queryRunner.manager.save(PrepagoGuardado, prepagoARS);
          this.logger.debug(`Prepago ARS ${comanda.prepagoARSID} marcado como UTILIZADO por flag usuarioConsumePrepagoARS = true`);
        }
      }

      if (comanda.usuarioConsumePrepagoUSD === true && comanda.prepagoUSDID) {
        const prepagoUSD = await queryRunner.manager.findOne(PrepagoGuardado, {
          where: { id: comanda.prepagoUSDID },
        });
        if (prepagoUSD && prepagoUSD.estado === EstadoPrepago.ACTIVA) {
          prepagoUSD.estado = EstadoPrepago.UTILIZADA;
          await queryRunner.manager.save(PrepagoGuardado, prepagoUSD);
          this.logger.debug(`Prepago USD ${comanda.prepagoUSDID} marcado como UTILIZADO por flag usuarioConsumePrepagoUSD = true`);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Comanda actualizada: ${comandaActualizada.id} - ${comandaActualizada.numero}`,
      );

      return await this.obtenerPorId(comandaActualizada.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error actualizando comanda: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async eliminar(id: string): Promise<void> {
    const comanda = await this.obtenerPorId(id);
    await this.comandaRepository.softRemove(comanda);
  }

  async restaurar(id: string): Promise<Comanda> {
    const comanda = await this.comandaRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!comanda) {
      throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
    }

    await this.comandaRepository.restore(id);

    return await this.obtenerPorId(id);
  }

  async crearEgreso(crearEgresoDto: CrearEgresoDto): Promise<Comanda> {
    console.log(crearEgresoDto);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Detectar si TODOS los egresos son de CAJA_2
      const todosEgresosSonCaja2 = crearEgresoDto.egresos?.every(
        egreso => (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_2
      ) ?? false;

      // Calcular montos totales para el movimiento (si es CAJA_2)
      let totalEgresosARS = 0;
      let totalEgresosUSD = 0;

      if (todosEgresosSonCaja2 && crearEgresoDto.egresos) {
        crearEgresoDto.egresos.forEach(egreso => {
          if (egreso.moneda === TipoMoneda.ARS) {
            totalEgresosARS += egreso.totalPesos;
          } else if (egreso.moneda === TipoMoneda.USD) {
            totalEgresosUSD += egreso.totalDolar;
          }
        });
      }

      let comanda = new Comanda();
      comanda.numero = crearEgresoDto.numero;
      comanda.tipoDeComanda = TipoDeComanda.EGRESO;

      // Si todos los egresos son de CAJA_2, traspasar automáticamente
      if (todosEgresosSonCaja2) {
        comanda.estadoDeComanda = EstadoDeComanda.TRASPASADA;
        comanda.caja = Caja.CAJA_2;
      } else {
        comanda.estadoDeComanda =
          crearEgresoDto.estadoDeComanda ?? EstadoDeComanda.FINALIZADA;
        comanda.caja = Caja.CAJA_1;
      }

      comanda.observaciones = crearEgresoDto.observaciones;
      comanda.precioDolar = crearEgresoDto.precioDolar;
      comanda.precioPesos = crearEgresoDto.precioPesos;
      comanda.valorDolar = crearEgresoDto.valorDolar;
      comanda.creadoPor = { id: crearEgresoDto.creadoPorId } as Personal;

      // Sumar solo egresos de CAJA_1 para validación
      const sumaEgresosDolarCaja1 = crearEgresoDto.egresos
        ?.filter(egreso => (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_1)
        .reduce((acc, egreso) => {
          return acc + egreso.totalDolar;
        }, 0) ?? 0;

      const sumaEgresosPesosCaja1 = crearEgresoDto.egresos
        ?.filter(egreso => (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_1)
        .reduce((acc, egreso) => {
          return acc + egreso.totalPesos;
        }, 0) ?? 0;

      // Solo validar si hay egresos de CAJA_1
      if (crearEgresoDto.egresos?.some(egreso => (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_1)) {
        const netoCajaChica = await this.obtenerMaximoArsUsdEgreso();

        if (
          sumaEgresosDolarCaja1 > netoCajaChica.usd &&
          crearEgresoDto.egresos?.some(
            (egreso) => egreso.moneda === TipoMoneda.USD && (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_1,
          )
        ) {
          throw new BadRequestException(
            'La caja 1 no tiene suficientes dolares para realizar el egreso',
          );
        }
        if (
          sumaEgresosPesosCaja1 > netoCajaChica.ars &&
          crearEgresoDto.egresos?.some(
            (egreso) => egreso.moneda === TipoMoneda.ARS && (egreso.caja ?? Caja.CAJA_1) === Caja.CAJA_1,
          )
        ) {
          throw new BadRequestException(
            'La caja 1 no tiene suficientes pesos para realizar el egreso',
          );
        }
      }

      const egresos = crearEgresoDto.egresos?.map((egreso) => {
        const egresoEntity = new Egreso();
        egresoEntity.total = egreso.total;
        egresoEntity.totalDolar = egreso.totalDolar;
        egresoEntity.totalPesos = egreso.totalPesos;
        egresoEntity.valorDolar = egreso.valorDolar;
        egresoEntity.moneda = egreso.moneda;
        egresoEntity.caja = egreso.caja ?? Caja.CAJA_1; // Usar caja del DTO o CAJA_1 por defecto
        return queryRunner.manager.create(Egreso, egresoEntity);
      });
      comanda.egresos = await Promise.all(egresos ?? []);

      // Si todos los egresos son de CAJA_2, crear un movimiento automáticamente
      if (todosEgresosSonCaja2) {
        const movimiento = await queryRunner.manager.save(Movimiento, {
          montoARS: totalEgresosARS,
          montoUSD: totalEgresosUSD,
          residualARS: 0,
          residualUSD: 0,
          comentario: `Egreso generado desde CAJA_1 - ${comanda.numero}`,
          esIngreso: false, // Es un egreso
          personal: { id: crearEgresoDto.creadoPorId } as Personal,
        });

        comanda.movimiento = movimiento;
      }

      const comandaGuardada = await queryRunner.manager.save(Comanda, comanda);

      await queryRunner.commitTransaction();

      return await this.obtenerPorId(comandaGuardada.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async actualizarEgreso(
    egresoId: string,
    actualizarEgresoDto: ActualizarEgresoDto,
  ): Promise<Egreso> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Buscar el egreso con su comanda y movimiento
      const egreso = await this.egresoRepository.findOne({
        where: { id: egresoId },
        relations: ['comanda', 'comanda.movimiento'],
      });

      if (!egreso) {
        throw new NotFoundException(`Egreso con ID ${egresoId} no encontrado`);
      }

      // Validar según la caja
      if (egreso.caja === Caja.CAJA_1) {
        // CAJA_1: Solo permitir si la comanda NO está traspasada
        if (egreso.comanda.estadoDeComanda === EstadoDeComanda.TRASPASADA) {
          throw new BadRequestException(
            'No se puede editar un egreso de CAJA_1 que ya está traspasado. ' +
            'Los egresos de CAJA_1 solo pueden editarse antes del traspaso.',
          );
        }
      }
      // CAJA_2: Permitir editar incluso si está traspasada (se traspasan automáticamente)

      // Calcular diferencias para validación de CAJA_1
      const montoAnteriorARS = egreso.moneda === TipoMoneda.ARS ? Number(egreso.totalPesos) : 0;
      const montoAnteriorUSD = egreso.moneda === TipoMoneda.USD ? Number(egreso.totalDolar) : 0;

      // Actualizar campos del egreso
      if (actualizarEgresoDto.total !== undefined) {
        egreso.total = actualizarEgresoDto.total;
      }
      if (actualizarEgresoDto.totalDolar !== undefined) {
        egreso.totalDolar = actualizarEgresoDto.totalDolar;
      }
      if (actualizarEgresoDto.totalPesos !== undefined) {
        egreso.totalPesos = actualizarEgresoDto.totalPesos;
      }
      if (actualizarEgresoDto.valorDolar !== undefined) {
        egreso.valorDolar = actualizarEgresoDto.valorDolar;
      }
      if (actualizarEgresoDto.moneda !== undefined) {
        egreso.moneda = actualizarEgresoDto.moneda;
      }

      // No permitir cambiar de CAJA_2 a CAJA_1 si está traspasada
      if (actualizarEgresoDto.caja !== undefined) {
        if (
          egreso.caja === Caja.CAJA_2 &&
          egreso.comanda.estadoDeComanda === EstadoDeComanda.TRASPASADA &&
          actualizarEgresoDto.caja === Caja.CAJA_1
        ) {
          throw new BadRequestException(
            'No se puede cambiar un egreso de CAJA_2 a CAJA_1 si la comanda ya está traspasada.',
          );
        }
        egreso.caja = actualizarEgresoDto.caja;
      }

      // Validar fondos disponibles para CAJA_1
      if (egreso.caja === Caja.CAJA_1) {
        const netoCajaChica = await this.obtenerMaximoArsUsdEgreso();

        // Calcular el impacto neto del cambio (monto nuevo + monto anterior que se libera)
        const montoNuevoARS = egreso.moneda === TipoMoneda.ARS ? Number(egreso.totalPesos) : 0;
        const montoNuevoUSD = egreso.moneda === TipoMoneda.USD ? Number(egreso.totalDolar) : 0;

        const impactoNetoARS = montoNuevoARS - montoAnteriorARS;
        const impactoNetoUSD = montoNuevoUSD - montoAnteriorUSD;

        // Solo validar si el impacto es positivo (se aumenta el egreso)
        if (impactoNetoUSD > 0 && impactoNetoUSD > netoCajaChica.usd) {
          throw new BadRequestException(
            `La caja 1 no tiene suficientes dólares. Disponible: $${netoCajaChica.usd.toFixed(2)}, Requiere: $${impactoNetoUSD.toFixed(2)} adicionales`,
          );
        }
        if (impactoNetoARS > 0 && impactoNetoARS > netoCajaChica.ars) {
          throw new BadRequestException(
            `La caja 1 no tiene suficientes pesos. Disponible: $${netoCajaChica.ars.toFixed(2)}, Requiere: $${impactoNetoARS.toFixed(2)} adicionales`,
          );
        }
      }

      // Guardar el egreso actualizado
      const egresoActualizado = await queryRunner.manager.save(Egreso, egreso);

      // Si es CAJA_2 y está traspasada, actualizar el movimiento asociado
      if (
        egreso.caja === Caja.CAJA_2 &&
        egreso.comanda.estadoDeComanda === EstadoDeComanda.TRASPASADA &&
        egreso.comanda.movimiento
      ) {
        // Obtener todos los egresos de la comanda para recalcular el total
        // Usar queryRunner.manager para obtener los valores actualizados dentro de la transacción
        const todosLosEgresos = await queryRunner.manager.find(Egreso, {
          where: { comanda: { id: egreso.comanda.id } },
        });

        let totalARS = 0;
        let totalUSD = 0;

        todosLosEgresos.forEach((e) => {
          if (e.moneda === TipoMoneda.ARS) {
            totalARS += Number(e.totalPesos);
          } else if (e.moneda === TipoMoneda.USD) {
            totalUSD += Number(e.totalDolar);
          }
        });

        // Actualizar la comanda con los nuevos totales
        await queryRunner.manager.update(
          Comanda,
          { id: egreso.comanda.id },
          {
            precioDolar: totalUSD,
            precioPesos: totalARS,
          },
        );

        // Actualizar el movimiento
        await queryRunner.manager.update(
          Movimiento,
          { id: egreso.comanda.movimiento.id },
          {
            montoARS: totalARS,
            montoUSD: totalUSD,
          },
        );

        this.logger.log(
          `Comanda ${egreso.comanda.id} actualizada: ARS=${totalARS}, USD=${totalUSD}`,
        );
        this.logger.log(
          `Movimiento ${egreso.comanda.movimiento.id} actualizado: ARS=${totalARS}, USD=${totalUSD}`,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Egreso ${egresoId} actualizado exitosamente`);

      // Retornar el egreso con sus relaciones
      const egresoFinal = await this.egresoRepository.findOne({
        where: { id: egresoId },
        relations: ['comanda', 'comanda.movimiento', 'comanda.creadoPor'],
      });

      if (!egresoFinal) {
        throw new NotFoundException(`Egreso con ID ${egresoId} no encontrado después de actualizar`);
      }

      return egresoFinal;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error actualizando egreso: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getLastComanda(): Promise<{ numero: string } | null> {
    const row = await this.comandaRepository
      .createQueryBuilder('c')
      .select('c.numero', 'numero')
      .where('c.caja = :caja', { caja: Caja.CAJA_1 })
      .andWhere('c.tipoDeComanda = :tipo', { tipo: TipoDeComanda.INGRESO })
      .orderBy("split_part(c.numero, '-', 1)::int", 'DESC') // serie
      .addOrderBy("split_part(c.numero, '-', 2)::int", 'DESC') // correlativo
      .limit(1)
      .getRawOne<{ numero: string }>();

    return row ?? null;
  }

  async netoCajaChica(): Promise<{
    totalIngresosARS: number;
    totalIngresosUSD: number;
  }> {
    const comandas = await this.comandaRepository.find({
      where: {
        estadoDeComanda: Not(
          In([
            EstadoDeComanda.CANCELADA,
            EstadoDeComanda.PENDIENTE,
            EstadoDeComanda.TRASPASADA,
          ]),
        ),
        caja: Caja.CAJA_1,
      },
      relations: [
        'items',
        'items.metodosPago',
        'items.productoServicio',
        'items.trabajador',
        'egresos',
        'metodosPago', // ← AGREGADO: cargar métodos de pago de la comanda
      ],
    });
    console.log(comandas.length, 'comandasLength');
    type Totals = { usd: number; ars: number };

    const totals: Totals = comandas.reduce<Totals>(
      (acc, comanda) => {
        // ✅ Priorizar metodosPago de la comanda si existen, sino usar los de los items
        const metodosPago = comanda.metodosPago && comanda.metodosPago.length > 0
          ? comanda.metodosPago
          : comanda.items?.flatMap((item) => item.metodosPago ?? []) ?? [];

        const comandaHasUSD =
          metodosPago.some((mp) => mp.moneda === 'USD') ?? false;

        metodosPago.forEach((mp) => {
          switch (mp.moneda) {
            case 'USD':
              acc.usd += mp.montoFinal ?? 0;
              break;

            case 'ARS':
              // Si la comanda tiene USD, priorizamos montoFinal; si no, monto.
              const montoARS = comandaHasUSD
                ? (mp.montoFinal ?? 0)
                : (mp.monto ?? 0);
              acc.ars += montoARS;
              break;
          }
        });

        const egresosArs = comanda.egresos?.reduce((acc, egreso) => {
          if (egreso.moneda === TipoMoneda.ARS) {
            acc += egreso.totalPesos;
          }
          return acc;
        }, 0);

        const egresosUsd = comanda.egresos?.reduce((acc, egreso) => {
          if (egreso.moneda === TipoMoneda.USD) {
            acc += egreso.totalDolar;
          }
          return acc;
        }, 0);

        acc.ars -= egresosArs ?? 0;
        acc.usd -= egresosUsd ?? 0;

        return acc;
      },
      { usd: 0, ars: 0 },
    ) ?? { usd: 0, ars: 0 };

    const totalIngresosUSD = totals.usd;
    const totalIngresosARS = totals.ars;

    console.log(totals);

    return {
      totalIngresosARS,
      totalIngresosUSD,
    };
  }

  async getLastComandaEgreso(): Promise<Comanda | null> {
    const lastComanda = await this.comandaRepository
      .createQueryBuilder('c')
      .select(['c.numero'])
      .where('c.tipoDeComanda = :tipo', { tipo: TipoDeComanda.EGRESO })
      .orderBy("CAST(SPLIT_PART(c.numero, '-', 2) AS INTEGER)", 'DESC')
      .addOrderBy("CAST(SPLIT_PART(c.numero, '-', 1) AS INTEGER)", 'DESC')
      .limit(1)
      .getOne();

    return lastComanda;
  }

  async getResumenCajaChica(filtros: {
    fechaDesde: string;
    fechaHasta: string;
  }): Promise<{
    totalCompletados: number;
    totalPendientes: number;
    montoNetoUSD: number;
    montoNetoARS: number;
    montoDisponibleTrasladoUSD: number;
    montoDisponibleTrasladoARS: number;
    totalIngresosUSD: number;
    totalIngresosARS: number;
    totalEgresosUSD: number;
    totalEgresosARS: number;
    comandasValidadasIds: string[];
    arsEfectivo: number;
    usdEfectivo: number;
    desglose?: {
      comandas: Array<{
        id: string;
        numero: string;
        estado: string;
        tipo: string;
        precioPesos: number;
        precioDolar: number;
        prepagoARSId: string | null;
        prepagoARSMonto: number;
        prepagoUSDId: string | null;
        prepagoUSDMonto: number;
        totalARS: number;
        totalUSD: number;
        egresos: Array<{
          id: string;
          moneda: string;
          monto: number;
        }>;
      }>;
      prepagosGuardados: Array<{
        id: string;
        moneda: string;
        monto: number;
        montoTraspasado: number;
        disponible: number;
        estado: string;
        clienteNombre?: string;
      }>;
      egresos: Array<{
        id: string;
        comandaId: string;
        comandaNumero: string;
        moneda: string;
        monto: number;
        descripcion?: string;
      }>;
      residualAnterior: {
        ARS: number;
        USD: number;
      };
      totalesPrepagos: {
        ARS: number;
        USD: number;
      };
    };
  }> {
    let comandas: Comanda[] = [];
    let prepagosGuardados: PrepagoGuardado[] = [];
    let ultimoMovimiento: Partial<Movimiento> = {
      residualARS: 0,
      residualUSD: 0,
    };
    const fechaDesde = new Date(filtros.fechaDesde);
    const fechaHasta = new Date(filtros.fechaHasta);
    let comandasValidadasIds: string[] = [];
    fechaDesde.setUTCHours(0, 0, 0, 0);
    fechaHasta.setUTCHours(23, 59, 59, 999);
    // reduce fechaHasta 1 dia
    fechaHasta.setDate(fechaHasta.getDate() - 1);
    if (filtros.fechaDesde && filtros.fechaHasta) {
      comandas = await this.comandaRepository.find({
        where: {
          estadoDeComanda: In([
            EstadoDeComanda.VALIDADO,
            EstadoDeComanda.PENDIENTE,
          ]),
          caja: Caja.CAJA_1,
          createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
            from: fechaDesde, // p.ej. '2025-08-01T03:00:00.000Z'
            to: fechaHasta, // fin exclusivo
          }),
        },
        relations: ['egresos', 'prepagoARS', 'prepagoUSD', 'items', 'items.metodosPago', 'metodosPago'],
      });
      prepagosGuardados = await this.prepagoGuardadoRepository.find({
        where: {
          estado: In([EstadoPrepago.ACTIVA, EstadoPrepago.UTILIZADA]),
          fechaCreacion: Raw((a) => `${a} >= :from AND ${a} < :to`, {
            from: fechaDesde,
            to: fechaHasta,
          }),
        },
        relations: ['cliente'],
      });
      ultimoMovimiento = await this.movimientoRepository.findOne({
        where: {
          createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
            from: fechaDesde,
            to: fechaHasta,
          }),
          esIngreso: true,
        },
        order: {
          createdAt: 'DESC',
        },
        relations: ['comandas'],
      }) ?? {
        residualARS: 0,
        residualUSD: 0,
      };
    } else {
      comandas = await this.comandaRepository.find({
        where: {
          estadoDeComanda: In([
            EstadoDeComanda.VALIDADO,
            EstadoDeComanda.PENDIENTE,
          ]),
          caja: Caja.CAJA_1,
        },
        relations: ['egresos', 'prepagoARS', 'prepagoUSD', 'items', 'items.metodosPago', 'metodosPago'],
      });
      prepagosGuardados = await this.prepagoGuardadoRepository.find({
        where: {
          estado: In([EstadoPrepago.ACTIVA]),
        },
        relations: ['cliente'],
      });
      ultimoMovimiento = await this.ultimoMovimiento(true);
    }

    let arsEfectivo = 0;
    let usdEfectivo = 0;

    comandasValidadasIds = comandas.reduce<string[]>((acc, c) => {
      if (c.estadoDeComanda === EstadoDeComanda.VALIDADO) {
        acc.push(c.id);
      }
      return acc;
    }, []);

    const helperComandas = comandas.reduce(
      (acc, comanda) => {
        /* ---------- Egresos ---------- */
        let totalEgresosARS = 0;
        let totalEgresosUSD = 0;

        (comanda.egresos ?? []).forEach((egreso) => {
          if (egreso.moneda === TipoMoneda.ARS) {
            totalEgresosARS += egreso.totalPesos ?? 0;
          } else if (egreso.moneda === TipoMoneda.USD) {
            totalEgresosUSD += egreso.totalDolar ?? 0;
          }
        });

        acc.totalEgresosARS += totalEgresosARS;
        acc.totalEgresosUSD += totalEgresosUSD;

        /* ---------- Estado de comanda ---------- */
        if (comanda.estadoDeComanda === EstadoDeComanda.VALIDADO) {
          acc.totalCompletados++;
        } else if (comanda.estadoDeComanda === EstadoDeComanda.PENDIENTE) {
          acc.totalPendientes++;
        }

        /* ---------- Ingresos (USD + ARS en un solo recorrido) ---------- */
        if (
          comanda.tipoDeComanda === TipoDeComanda.INGRESO &&
          comanda.estadoDeComanda === EstadoDeComanda.VALIDADO
        ) {
          const metodoPagoComanda = comanda.metodosPago && comanda.metodosPago.length > 0
            ? comanda.metodosPago
            : comanda.items?.flatMap((item) => item.metodosPago ?? []) ?? [];
          
          const totalIngresosARS = Number(metodoPagoComanda.reduce((accMP, mp) => {
            if (mp.moneda === TipoMoneda.ARS) {
              if (mp.tipo === TipoPago.EFECTIVO) {
                arsEfectivo += (mp.montoFinal ?? 0);
              }
              return accMP + (mp.montoFinal ?? 0);
            }
            return accMP;
          }, 0));
          // this.logger.fatal(totalIngresosARS, 'totalIngresosARS1');
          // this.logger.fatal(acc.totalIngresosARS, 'totalIngresosARS2');
          const totalIngresosUSD = Number(metodoPagoComanda.reduce((accMP, mp) => {
            if (mp.moneda === TipoMoneda.USD) {
              if (mp.tipo === TipoPago.EFECTIVO) {
                usdEfectivo += (mp.montoFinal ?? 0);
              }
              return accMP + (mp.montoFinal ?? 0);
            }
            return accMP;
          }, 0));

          acc.totalIngresosARS +=
            totalIngresosARS
          // this.logger.fatal(acc.totalIngresosARS, 'totalIngresosARS3');
          acc.totalIngresosUSD +=
            totalIngresosUSD
          acc.montoNetoARS += acc.totalIngresosARS - acc.totalEgresosARS;
          acc.montoNetoUSD += acc.totalIngresosUSD - acc.totalEgresosUSD;
        }

        return acc;
      },
      {
        totalCompletados: 0,
        totalPendientes: 0,
        totalEgresosARS: 0,
        totalEgresosUSD: 0,
        totalIngresosARS: 0,
        totalIngresosUSD: 0,
        montoNetoARSValidado: 0,
        montoNetoUSDValidado: 0,
        montoNetoARS: 0,
        montoNetoUSD: 0,
        totalTransaccionesARS: 0,
        totalTransaccionesUSD: 0,
      },
    );

    console.log('DEBUG - arsEfectivo', arsEfectivo);
    console.log('DEBUG - usdEfectivo', usdEfectivo);

    let noComandasValues: {
      montoSeñasARS: number;
      montoSeñasUSD: number;
    } = {
      montoSeñasARS: 0,
      montoSeñasUSD: 0,
    };
    if (comandas.length === 0 || comandas.every((c) => c.tipoDeComanda === TipoDeComanda.EGRESO)) {
      noComandasValues = {
        montoSeñasARS: prepagosGuardados
          .filter((pg) => pg.moneda === TipoMoneda.ARS)
          .reduce(
            (acc, pg) =>
              acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
            0,
          ),
        montoSeñasUSD: prepagosGuardados
          .filter((pg) => pg.moneda === TipoMoneda.USD)
          .reduce(
            (acc, pg) =>
              acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
            0,
          ),
      };
    }


    // console.log('DEBUG - prepagosArs', prepagosGuardados.filter((pg) => pg.moneda === TipoMoneda.ARS).map(pg => {
    //   if (Number(pg.monto) - Number(pg.montoTraspasado ?? 0) > 0) {
    //     return {
    //       id: pg.id,
    //       monto: pg.monto,
    //       fechaCreacion: pg.fechaCreacion,
    //       montoTraspasado: pg.montoTraspasado,
    //       disponible: Number(pg.monto) - Number(pg.montoTraspasado ?? 0)
    //     };
    //   }
    // }));

    console.log('DEBUG - prepagosUsd', prepagosGuardados.filter((pg) => pg.moneda === TipoMoneda.USD).map(pg => {
      if (Number(pg.monto) - Number(pg.montoTraspasado ?? 0) > 0) {
        return {
          id: pg.id,
          monto: pg.monto,
          fechaCreacion: pg.fechaCreacion,
          montoTraspasado: pg.montoTraspasado,
          disponible: Number(pg.monto) - Number(pg.montoTraspasado ?? 0)
        };
      }
    }));

    const totalPrepagosARS = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.ARS)
      .reduce(
        (acc, pg) => {
          if (pg.tipoPago === TipoPago.EFECTIVO) {
            arsEfectivo += (Number(pg.monto)) - (Number(pg.montoTraspasado) ?? 0);
          }
          return acc + (Number(pg.monto) - Number(pg.montoTraspasado));
        }, 0
      );
    const totalPrepagosUSD = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.USD)
      .reduce(
        (acc, pg) => {
          if (pg.tipoPago === TipoPago.EFECTIVO) {
            usdEfectivo += (Number(pg.monto)) - (Number(pg.montoTraspasado) ?? 0);
          }
          return acc + (Number(pg.monto) - Number(pg.montoTraspasado));
        },
        0,
      );

    // console.table({
    //   totalIngresosARS: helperComandas.totalIngresosARS + totalPrepagosARS,
    //   totalIngresosUSD: helperComandas.totalIngresosUSD + totalPrepagosUSD,
    //   totalEgresosARS: helperComandas.totalEgresosARS,
    //   totalEgresosUSD: helperComandas.totalEgresosUSD,
    //   montoNetoARS: helperComandas.montoNetoARS,
    //   montoNetoUSD: helperComandas.montoNetoUSD,
    //   prepagosARS: totalPrepagosARS,
    //   prepagosUSD: totalPrepagosUSD,
    //   prepagosTraspasadosARS: prepagosGuardados
    //     .filter((pg) => pg.moneda === TipoMoneda.ARS)
    //     .reduce((acc, pg) => acc + Number(pg.montoTraspasado ?? 0), 0),
    //   prepagosTraspasadosUSD: prepagosGuardados
    //     .filter((pg) => pg.moneda === TipoMoneda.USD)
    //     .reduce((acc, pg) => acc + Number(pg.montoTraspasado ?? 0), 0),
    //   prepagosNoTraspasadosARS: prepagosGuardados
    //     .filter((pg) => pg.moneda === TipoMoneda.ARS)
    //     .reduce(
    //       (acc, pg) =>
    //         acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
    //       0,
    //     ),
    //   prepagosNoTraspasadosUSD: prepagosGuardados
    //     .filter((pg) => pg.moneda === TipoMoneda.USD)
    //     .reduce(
    //       (acc, pg) =>
    //         acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
    //       0,
    //     ),
    // });
    // console.table({
    //   prepagosGuardados: prepagosGuardados.length,
    //   ultimoMovimientoResidualARS: ultimoMovimiento.residualARS,
    //   ultimoMovimientoResidualUSD: ultimoMovimiento.residualUSD,
    // });
    // Construir desglose detallado
    const desgloseComandas = comandas
      .filter((comanda) =>
        comanda.tipoDeComanda === TipoDeComanda.INGRESO &&
        comanda.estadoDeComanda === EstadoDeComanda.VALIDADO
      )
      .map((comanda) => {
        const prepagoARSMonto = Number(comanda.prepagoARS?.monto ?? 0);
        const prepagoUSDMonto = Number(comanda.prepagoUSD?.monto ?? 0);
        const precioPesos = Number(comanda.precioPesos ?? 0);
        const precioDolar = Number(comanda.precioDolar ?? 0);

        // Mapear egresos de esta comanda (solo de caja 1)
        const egresosComanda = (comanda.egresos ?? [])
          .filter((egreso) => egreso.caja === Caja.CAJA_1)
          .map((egreso) => ({
            id: egreso.id,
            moneda: egreso.moneda,
            monto: egreso.moneda === TipoMoneda.ARS
              ? Number(egreso.totalPesos ?? 0)
              : Number(egreso.totalDolar ?? 0),
          }));

        return {
          id: comanda.id,
          numero: comanda.numero,
          estado: comanda.estadoDeComanda,
          tipo: comanda.tipoDeComanda,
          precioPesos,
          precioDolar,
          prepagoARSId: comanda.prepagoARS?.id ?? null,
          prepagoARSMonto,
          prepagoUSDId: comanda.prepagoUSD?.id ?? null,
          prepagoUSDMonto,
          totalARS: precioPesos + prepagoARSMonto,
          totalUSD: precioDolar + prepagoUSDMonto,
          egresos: egresosComanda,
        };
      });
    const desglosePrepagsGuardados = prepagosGuardados
      .filter((prepago) => {
        const disponible = Number(prepago.monto) - (prepago.montoTraspasado ? Number(prepago.montoTraspasado) : 0);
        return disponible > 0;
      })
      .map((prepago) => ({
        id: prepago.id,
        moneda: prepago.moneda,
        monto: Number(prepago.monto ?? 0),
        montoTraspasado: Number(prepago.montoTraspasado ?? 0),
        disponible: Number(prepago.monto ?? 0) - Number(prepago.montoTraspasado ?? 0),
        estado: prepago.estado,
        clienteNombre: prepago.cliente?.nombre ?? 'Sin cliente',
      }));

    const desgloseEgresos: Array<{
      id: string;
      comandaId: string;
      comandaNumero: string;
      moneda: string;
      monto: number;
    }> = [];

    comandas.forEach((comanda) => {
      (comanda.egresos ?? [])
        .filter((egreso) => egreso.caja === Caja.CAJA_1)
        .forEach((egreso) => {
          desgloseEgresos.push({
            id: egreso.id,
            comandaId: comanda.id,
            comandaNumero: comanda.numero,
            moneda: egreso.moneda,
            monto: egreso.moneda === TipoMoneda.ARS
              ? Number(egreso.totalPesos ?? 0)
              : Number(egreso.totalDolar ?? 0),
          });
        });
    });

    return {
      totalCompletados: helperComandas.totalCompletados,
      totalPendientes: helperComandas.totalPendientes,
      montoNetoUSD:
        helperComandas.totalIngresosUSD + totalPrepagosUSD +
        Number(ultimoMovimiento?.residualUSD ?? 0) +
        noComandasValues.montoSeñasUSD -
        helperComandas.totalEgresosUSD,
      montoNetoARS:
        helperComandas.totalIngresosARS + totalPrepagosARS +
        Number(ultimoMovimiento?.residualARS ?? 0) +
        noComandasValues.montoSeñasARS -
        helperComandas.totalEgresosARS,
      montoDisponibleTrasladoUSD:
        helperComandas.totalIngresosUSD + totalPrepagosUSD +
        Number(ultimoMovimiento?.residualUSD ?? 0) +
        noComandasValues.montoSeñasUSD -
        helperComandas.totalEgresosUSD,
      montoDisponibleTrasladoARS:
        helperComandas.totalIngresosARS + totalPrepagosARS +
        Number(ultimoMovimiento?.residualARS ?? 0) +
        noComandasValues.montoSeñasARS -
        helperComandas.totalEgresosARS,
      totalIngresosUSD:
        helperComandas.totalIngresosUSD + totalPrepagosUSD +
        Number(ultimoMovimiento?.residualUSD ?? 0),
      totalIngresosARS:
        helperComandas.totalIngresosARS + totalPrepagosARS + 
        Number(ultimoMovimiento?.residualARS ?? 0) 
        ,
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      comandasValidadasIds,
      arsEfectivo: arsEfectivo + Number(ultimoMovimiento?.residualARS ?? 0) - helperComandas.totalEgresosARS,
      usdEfectivo: usdEfectivo + Number(ultimoMovimiento?.residualUSD ?? 0) - helperComandas.totalEgresosUSD,
      desglose: {
        comandas: desgloseComandas,
        prepagosGuardados: desglosePrepagsGuardados,
        egresos: desgloseEgresos,
        residualAnterior: {
          ARS: Number(ultimoMovimiento?.residualARS ?? 0),
          USD: Number(ultimoMovimiento?.residualUSD ?? 0),
        },
        totalesPrepagos: {
          ARS: totalPrepagosARS,
          USD: totalPrepagosUSD,
        },
      },
    };
  }

  async getResumenCajaPorMetodoPago(filtros: {
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<{
    totalCompletados: number;
    totalPendientes: number;
    montoNetoUSD: number;
    montoNetoARS: number;
    montoDisponibleTrasladoUSD: number;
    montoDisponibleTrasladoARS: number;
    totalIngresosUSD: number;
    totalIngresosARS: number;
    ingresosComandasARS: number;
    ingresosComandasUSD: number;
    ingresosPrepagosARS: number;
    ingresosPrepagosUSD: number;
    totalEgresosUSD: number;
    totalEgresosARS: number;
    comandasValidadasIds: string[];
    porMetodoPago: {
      [key in TipoPago]: {
        ARS: number;
        USD: number;
      };
    };
    porMetodoPagoEgresos: {
      [key in TipoPago]: {
        ARS: number;
        USD: number;
      };
    };
    porUnidadNegocio: {
      [unidadNegocioId: string]: {
        nombre: string;
        totalARS: number;
        totalUSD: number;
      };
    };
  }> {
    // Use today's date if not provided
    const hoy = DateTime.now().setZone('America/Argentina/Buenos_Aires');

    // Parse the provided dates or use today
    const fechaDesdeSeleccionada = filtros.fechaDesde
      ? DateTime.fromISO(filtros.fechaDesde, { zone: 'America/Argentina/Buenos_Aires' })
      : hoy;

    const fechaHastaSeleccionada = filtros.fechaHasta
      ? DateTime.fromISO(filtros.fechaHasta, { zone: 'America/Argentina/Buenos_Aires' })
      : fechaDesdeSeleccionada;

    // Get start and end of the selected date range
    const fechaDesde = fechaDesdeSeleccionada.startOf('day').toJSDate();
    const fechaHasta = fechaHastaSeleccionada.endOf('day').toJSDate();

    let comandasValidadasIds: string[] = [];

    const comandas = await this.comandaRepository.find({
      where: {
        estadoDeComanda: In([
          EstadoDeComanda.VALIDADO,
          EstadoDeComanda.PENDIENTE,
          EstadoDeComanda.TRASPASADA,
        ]),
        createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
          from: fechaDesde,
          to: fechaHasta,
        }),
      },
      relations: ['egresos', 'prepagoARS', 'prepagoUSD', 'items', 'items.metodosPago', 'items.productoServicio', 'items.productoServicio.unidadNegocio', 'metodosPago'],
    });

    const prepagosGuardados = await this.prepagoGuardadoRepository.find({
      where: {
        estado: In([EstadoPrepago.ACTIVA, EstadoPrepago.UTILIZADA]),
        fechaCreacion: Raw((a) => `${a} >= :from AND ${a} < :to`, {
          from: fechaDesde,
          to: fechaHasta,
        }),
      },
    });



    comandasValidadasIds = comandas.reduce<string[]>((acc, c) => {
      if (c.estadoDeComanda === EstadoDeComanda.VALIDADO) {
        acc.push(c.id);
      }
      return acc;
    }, []);

    // Initialize payment method breakdown for ingresos
    const porMetodoPago: {
      [key in TipoPago]: {
        ARS: number;
        USD: number;
      };
    } = {
      [TipoPago.EFECTIVO]: { ARS: 0, USD: 0 },
      [TipoPago.TARJETA]: { ARS: 0, USD: 0 },
      [TipoPago.TRANSFERENCIA]: { ARS: 0, USD: 0 },
      [TipoPago.CHEQUE]: { ARS: 0, USD: 0 },
      [TipoPago.QR]: { ARS: 0, USD: 0 },
      [TipoPago.GIFT_CARD]: { ARS: 0, USD: 0 },
      [TipoPago.MERCADO_PAGO]: { ARS: 0, USD: 0 },
    };

    // Initialize payment method breakdown for egresos
    const porMetodoPagoEgresos: {
      [key in TipoPago]: {
        ARS: number;
        USD: number;
      };
    } = {
      [TipoPago.EFECTIVO]: { ARS: 0, USD: 0 },
      [TipoPago.TARJETA]: { ARS: 0, USD: 0 },
      [TipoPago.TRANSFERENCIA]: { ARS: 0, USD: 0 },
      [TipoPago.CHEQUE]: { ARS: 0, USD: 0 },
      [TipoPago.QR]: { ARS: 0, USD: 0 },
      [TipoPago.GIFT_CARD]: { ARS: 0, USD: 0 },
      [TipoPago.MERCADO_PAGO]: { ARS: 0, USD: 0 },
    };

    // Initialize breakdown by business unit
    const porUnidadNegocio: {
      [unidadNegocioId: string]: {
        nombre: string;
        totalARS: number;
        totalUSD: number;
      };
    } = {};

    // Guardar comandas en archivo JSON para debugging
    // if (comandas.length > 0) {
    //   try {
    //     const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss');
    //     const fileName = `comandas-debug-${timestamp}.json`;
    //     const filePath = join(process.cwd(), fileName);

    //     writeFileSync(
    //       filePath,
    //       JSON.stringify(comandas, null, 2),
    //       'utf-8'
    //     );

    //     this.logger.log(`Comandas guardadas en: ${fileName}`);
    //   } catch (error) {
    //     this.logger.error('Error al guardar archivo JSON de comandas:', error);
    //   }
    // }

    const helperComandas = comandas.reduce(
      (acc, comanda) => {

        /* ---------- Egresos ---------- */
        let totalEgresosARS = 0;
        let totalEgresosUSD = 0;

        (comanda.egresos ?? []).forEach((egreso) => {
          if (egreso.caja === Caja.CAJA_1) {
            if (egreso.moneda === TipoMoneda.ARS) {
              totalEgresosARS += egreso.totalPesos ?? 0;
            } else if (egreso.moneda === TipoMoneda.USD) {
              totalEgresosUSD += egreso.totalDolar ?? 0;
            }
          }
        });

        acc.totalEgresosARS += totalEgresosARS;
        acc.totalEgresosUSD += totalEgresosUSD;

        /* ---------- Estado de comanda ---------- */
        if (comanda.estadoDeComanda === EstadoDeComanda.VALIDADO) {
          acc.totalCompletados++;
        } else if (comanda.estadoDeComanda === EstadoDeComanda.PENDIENTE) {
          acc.totalPendientes++;
        }

        /* ---------- Ingresos (USD + ARS en un solo recorrido) ---------- */
        if (
          comanda.tipoDeComanda === TipoDeComanda.INGRESO
        ) {
          // NO sumamos prepagos aquí porque ya se sumaron cuando se crearon
          // Solo sumamos lo que realmente ingresó en esta comanda
          const totalIngresosARS = Number(comanda.precioPesos);
          const totalIngresosUSD = Number(comanda.precioDolar);

          acc.totalIngresosARS += totalIngresosARS;
          acc.totalIngresosUSD += totalIngresosUSD;

          /* ---------- Process payment methods by type (INGRESOS) ---------- */
          // Priorizar metodosPago de la comanda si existen, sino usar los de los items
          const metodosPagoParaProcesar = comanda.metodosPago && comanda.metodosPago.length > 0
            ? comanda.metodosPago
            : comanda.items?.flatMap((item) => item.metodosPago ?? []) ?? [];

          metodosPagoParaProcesar.forEach((metodoPago) => {
            const montoFinal = Number(metodoPago.montoFinal ?? 0);
            const tipoMoneda = metodoPago.moneda;
            const tipoPago = metodoPago.tipo;

            if (tipoMoneda === TipoMoneda.ARS) {
              porMetodoPago[tipoPago].ARS += montoFinal;
            } else if (tipoMoneda === TipoMoneda.USD) {
              porMetodoPago[tipoPago].USD += montoFinal;
            }
          });

          /* ---------- Process breakdown by business unit (INGRESOS) ---------- */
          // Check if items have payment methods at item level
          const tieneMetodosPagoEnItems = comanda.items?.some(
            (item) => item.metodosPago && item.metodosPago.length > 0
          );

          if (tieneMetodosPagoEnItems) {
            // If items have their own payment methods, use those
            comanda.items?.forEach((item) => {
              const unidadNegocio = item.productoServicio?.unidadNegocio;

              if (unidadNegocio && item.metodosPago && item.metodosPago.length > 0) {
                // Initialize if not exists
                if (!porUnidadNegocio[unidadNegocio.id]) {
                  porUnidadNegocio[unidadNegocio.id] = {
                    nombre: unidadNegocio.nombre,
                    totalARS: 0,
                    totalUSD: 0,
                  };
                }

                item.metodosPago.forEach((metodoPago) => {
                  const montoFinal = Number(metodoPago.montoFinal ?? 0);
                  const tipoMoneda = metodoPago.moneda;

                  if (tipoMoneda === TipoMoneda.ARS) {
                    porUnidadNegocio[unidadNegocio.id].totalARS += montoFinal;
                  } else if (tipoMoneda === TipoMoneda.USD) {
                    porUnidadNegocio[unidadNegocio.id].totalUSD += montoFinal;
                  }
                });
              }
            });
          } else {
            // If payment methods are at comanda level, distribute proportionally
            if (metodosPagoParaProcesar.length > 0 && comanda.items && comanda.items.length > 0) {
              // Determine the currency of the comanda based on payment methods
              const todosPagosEnUSD = metodosPagoParaProcesar.every(mp => mp.moneda === TipoMoneda.USD);
              const todosPagosEnARS = metodosPagoParaProcesar.every(mp => mp.moneda === TipoMoneda.ARS);

              // Step 1: Calculate subtotal for each item (precio - descuento)
              // Convert USD prices to ARS only when payments are in ARS
              const itemsConSubtotales = comanda.items.map((item) => {
                const unidadNegocio = item.productoServicio?.unidadNegocio;
                let precio = Number(item.precio ?? 0);
                const cantidad = Number(item.cantidad ?? 1);
                const descuento = Number(item.descuento ?? 0);

                // Check if price needs to be converted from USD to ARS
                const esPrecioCongelado = item.productoServicio?.esPrecioCongelado;
                const precioFijoARS = Number(item.productoServicio?.precioFijoARS ?? 0);

                // If not frozen price in ARS and all payments are in ARS, convert USD to ARS
                if (todosPagosEnARS && (!esPrecioCongelado || precioFijoARS === 0)) {
                  const valorDolar = Number(comanda.valorDolar ?? 1);
                  precio = precio * valorDolar;
                }
                // If payments are in USD, keep USD prices as is (don't convert)

                const subtotal = (precio * cantidad) - descuento;

                return {
                  item,
                  unidadNegocio,
                  subtotal,
                  precio,
                  descuento,
                };
              }).filter(x => x.unidadNegocio); // Only items with business unit

              // Step 2: Group items by business unit and calculate their totals
              const unidadesPorId = new Map<string, {
                unidadNegocio: any,
                totalItems: number,
              }>();

              itemsConSubtotales.forEach((itemData) => {
                const unidadId = itemData.unidadNegocio.id;

                if (!unidadesPorId.has(unidadId)) {
                  unidadesPorId.set(unidadId, {
                    unidadNegocio: itemData.unidadNegocio,
                    totalItems: 0,
                  });
                }

                const unidadData = unidadesPorId.get(unidadId)!;
                unidadData.totalItems += itemData.subtotal;
              });

              // Step 3: Handle prepago (deposit) - subtract from highest value business unit
              // Prepagos are NOT income for today, they were paid on a different day
              let montoPrepagoADescontar = 0;

              if (comanda.usuarioConsumePrepagoARS && comanda.prepagoARS) {
                const montoPrepagoARS = Number(comanda.prepagoARS.monto ?? 0);

                if (todosPagosEnARS) {
                  // Prepago in ARS, payments in ARS - no conversion needed
                  montoPrepagoADescontar = montoPrepagoARS;
                } else if (todosPagosEnUSD) {
                  // Prepago in ARS, payments in USD - convert ARS to USD
                  const valorDolar = Number(comanda.valorDolar ?? 1);
                  montoPrepagoADescontar = valorDolar > 0 ? montoPrepagoARS / valorDolar : 0;
                }
              }
              else if (comanda.usuarioConsumePrepagoUSD && comanda.prepagoUSD) {
                const montoPrepagoUSD = Number(comanda.prepagoUSD.monto ?? 0);

                if (todosPagosEnARS) {
                  // Prepago in USD, payments in ARS - convert USD to ARS
                  const valorDolar = Number(comanda.valorDolar ?? 1);
                  montoPrepagoADescontar = montoPrepagoUSD * valorDolar;
                } else if (todosPagosEnUSD) {
                  // Prepago in USD, payments in USD - no conversion needed
                  montoPrepagoADescontar = montoPrepagoUSD;
                }
              }

              // Step 4: Find business unit with highest value and subtract prepago
              let unidadConMayorValor: string | null = null;
              let mayorValor = 0;

              unidadesPorId.forEach((data, unidadId) => {
                if (data.totalItems > mayorValor) {
                  mayorValor = data.totalItems;
                  unidadConMayorValor = unidadId;
                }
              });

              // Step 5: Calculate totals after subtracting prepago from highest value unit
              const unidadesAjustadas = new Map<string, number>();

              unidadesPorId.forEach((data, unidadId) => {
                let totalAjustado = data.totalItems;

                // Subtract prepago from highest value business unit only
                if (unidadId === unidadConMayorValor && montoPrepagoADescontar > 0) {
                  totalAjustado = Math.max(0, totalAjustado - montoPrepagoADescontar);
                }

                unidadesAjustadas.set(unidadId, totalAjustado);
              });

              // Step 6: Calculate total after prepago discount (this is the actual income for today)
              const totalDespuesPrepago = Array.from(unidadesAjustadas.values()).reduce((sum, val) => sum + val, 0);

              // Step 7: Distribute payment methods proportionally based on adjusted totals
              if (totalDespuesPrepago > 0) {
                metodosPagoParaProcesar.forEach((metodoPago) => {
                  const montoFinal = Number(metodoPago.montoFinal ?? 0);
                  const tipoMoneda = metodoPago.moneda;

                  unidadesAjustadas.forEach((totalAjustado, unidadId) => {
                    const unidadData = unidadesPorId.get(unidadId)!;

                    // Initialize business unit if not exists
                    if (!porUnidadNegocio[unidadId]) {
                      porUnidadNegocio[unidadId] = {
                        nombre: unidadData.unidadNegocio.nombre,
                        totalARS: 0,
                        totalUSD: 0,
                      };
                    }

                    // Calculate proportional amount for this business unit
                    const proporcion = totalAjustado / totalDespuesPrepago;
                    const montoParaUnidad = montoFinal * proporcion;

                    if (tipoMoneda === TipoMoneda.ARS) {
                      porUnidadNegocio[unidadId].totalARS += montoParaUnidad;
                    } else if (tipoMoneda === TipoMoneda.USD) {
                      porUnidadNegocio[unidadId].totalUSD += montoParaUnidad;
                    }
                  });
                });
              }
            }
          }
        }

        /* ---------- Egresos - Process payment methods by type ---------- */
        if (
          comanda.tipoDeComanda === TipoDeComanda.EGRESO
        ) {
          // Priorizar metodosPago de la comanda si existen, sino usar los de los items
          const metodosPagoEgresosParaProcesar = comanda.metodosPago && comanda.metodosPago.length > 0
            ? comanda.metodosPago
            : comanda.items?.flatMap((item) => item.metodosPago ?? []) ?? [];

          metodosPagoEgresosParaProcesar.forEach((metodoPago) => {
            console.table(metodoPago);
            const montoFinal = Number(metodoPago.montoFinal ?? 0);
            const tipoMoneda = metodoPago.moneda;
            const tipoPago = metodoPago.tipo;

            if (tipoMoneda === TipoMoneda.ARS) {
              porMetodoPagoEgresos[tipoPago].ARS += montoFinal;
            } else if (tipoMoneda === TipoMoneda.USD) {
              porMetodoPagoEgresos[tipoPago].USD += montoFinal;
            }
          });
        }

        return acc;
      },
      {
        totalCompletados: 0,
        totalPendientes: 0,
        totalEgresosARS: 0,
        totalEgresosUSD: 0,
        totalIngresosARS: 0,
        totalIngresosUSD: 0,
      },
    );

    let noComandasValues: {
      montoSeñasARS: number;
      montoSeñasUSD: number;
    } = {
      montoSeñasARS: 0,
      montoSeñasUSD: 0,
    };
    if (comandas.length === 0 || comandas.every((c) => c.tipoDeComanda === TipoDeComanda.EGRESO)) {
      noComandasValues = {
        montoSeñasARS: prepagosGuardados
          .filter((pg) => pg.moneda === TipoMoneda.ARS)
          .reduce(
            (acc, pg) =>
              acc + Number(pg.monto),
            0,
          ),
        montoSeñasUSD: prepagosGuardados
          .filter((pg) => pg.moneda === TipoMoneda.USD)
          .reduce(
            (acc, pg) =>
              acc + Number(pg.monto),
            0,
          ),
      };
    }

    // Add prepago guardado amounts to payment method breakdown (para que el desglose incluya prepagos del día)
    prepagosGuardados.forEach((prepago) => {
      const monto = Number(prepago.monto ?? 0);
      const tipoMoneda = prepago.moneda;
      const tipoPago = prepago.tipoPago;

      console.log('DEBUG - Prepago guardado:', { tipoPago, tipoMoneda, monto });

      if (tipoMoneda === TipoMoneda.ARS) {
        porMetodoPago[tipoPago].ARS += monto;
      } else if (tipoMoneda === TipoMoneda.USD) {
        porMetodoPago[tipoPago].USD += monto;
      }
    });

    const totalPrepagosARS = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.ARS)
      .reduce(
        (acc, pg) =>
          acc + (Number(pg.monto)),
        0,
      );
    const totalPrepagosUSD = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.USD)
      .reduce(
        (acc, pg) =>
          acc + (Number(pg.monto)),
        0,
      );

    // ---------- OPCIÓN A: SIEMPRE sumar prepagos del día a los totales ----------
    const totalIngresosUSD =
      helperComandas.totalIngresosUSD +
      noComandasValues.montoSeñasUSD +
      totalPrepagosUSD;

    const totalIngresosARS =
      helperComandas.totalIngresosARS +
      noComandasValues.montoSeñasARS +
      totalPrepagosARS;

    // Desglose separado de ingresos
    const ingresosComandasARS = helperComandas.totalIngresosARS;
    const ingresosComandasUSD = helperComandas.totalIngresosUSD;
    const ingresosPrepagosARS = noComandasValues.montoSeñasARS + totalPrepagosARS;
    const ingresosPrepagosUSD = noComandasValues.montoSeñasUSD + totalPrepagosUSD;

    // console.log('DEBUG - Desglose final por método de pago (INGRESOS):', JSON.stringify(porMetodoPago, null, 2));
    // console.log('DEBUG - Desglose final por método de pago (EGRESOS):', JSON.stringify(porMetodoPagoEgresos, null, 2));

    return {
      totalCompletados: helperComandas.totalCompletados,
      totalPendientes: helperComandas.totalPendientes,
      montoNetoUSD: totalIngresosUSD,
      montoNetoARS: totalIngresosARS,
      montoDisponibleTrasladoUSD: totalIngresosUSD,
      montoDisponibleTrasladoARS: totalIngresosARS,
      totalIngresosUSD,
      totalIngresosARS,
      ingresosComandasARS,
      ingresosComandasUSD,
      ingresosPrepagosARS,
      ingresosPrepagosUSD,
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      comandasValidadasIds,
      porMetodoPago,
      porMetodoPagoEgresos,
      porUnidadNegocio,
    };
  }


  async cambiarEstado(
    id: string,
    nuevoEstado: EstadoDeComanda,
  ): Promise<Comanda> {
    const comanda = await this.obtenerPorId(id);
    comanda.estadoDeComanda = nuevoEstado;

    const comandaActualizada = await this.comandaRepository.save(comanda);

    return await this.obtenerPorId(comandaActualizada.id);
  }

  private aplicarFiltros(
    queryBuilder: SelectQueryBuilder<Comanda>,
    filtros: Partial<FiltrarComandasDto>,
  ): void {
    if (filtros.search) {
      queryBuilder.andWhere('comanda.numero ILIKE :search', {
        search: `%${filtros.search}%`,
      });
    }

    if (filtros.tipoDeComanda) {
      queryBuilder.andWhere('comanda.tipoDeComanda = :tipoDeComanda', {
        tipoDeComanda: filtros.tipoDeComanda,
      });
    }

    if (filtros.estadoDeComanda) {
      queryBuilder.andWhere('comanda.estadoDeComanda = :estadoDeComanda', {
        estadoDeComanda: filtros.estadoDeComanda,
      });
    }

    if (filtros.caja) {
      queryBuilder.andWhere('comanda.caja = :caja', {
        caja: filtros.caja,
      });
    }

    if (filtros.trabajadorNombre) {
      queryBuilder.andWhere(
        'LOWER(trabajador.nombre) ILIKE LOWER(:trabajadorNombre)',
        {
          trabajadorNombre: `%${filtros.trabajadorNombre.trim()}%`,
        },
      );
    }

    if (filtros.clienteNombre) {
      queryBuilder.andWhere(
        'LOWER(cliente.nombre) ILIKE LOWER(:clienteNombre)',
        {
          clienteNombre: `%${filtros.clienteNombre}%`,
        },
      );
    }

    if (filtros.creadoPorNombre) {
      queryBuilder.andWhere(
        'LOWER(creadoPor.nombre) ILIKE LOWER(:creadoPorNombre)',
        {
          creadoPorNombre: `%${filtros.creadoPorNombre.trim()}%`,
        },
      );
    }

    if (filtros.unidadNegocioId) {
      queryBuilder.andWhere('unidadNegocio.id = :unidadNegocioId', {
        unidadNegocioId: filtros.unidadNegocioId,
      });
    }

    if (filtros.servicioId) {
      queryBuilder.andWhere('productoServicio.id = :servicioId', {
        servicioId: filtros.servicioId,
      });
    }

    if (filtros.fechaDesde && filtros.fechaHasta) {
      // ─ Caso “mismo día”: de 00:00:00 a 23:59:59.999 ─
      if (filtros.fechaDesde === filtros.fechaHasta) {
        const inicio = new Date(filtros.fechaDesde);
        inicio.setUTCHours(0, 0, 0, 0);

        const fin = new Date(filtros.fechaHasta);
        fin.setUTCHours(23, 59, 59, 999);

        queryBuilder.andWhere('comanda.createdAt BETWEEN :inicio AND :fin', {
          inicio,
          fin,
        });
      }
      // ─ Rango normal ─
      else {
        queryBuilder.andWhere(
          'comanda.createdAt BETWEEN :fechaDesde AND :fechaHasta',
          { fechaDesde: filtros.fechaDesde, fechaHasta: filtros.fechaHasta },
        );
      }
    } else if (filtros.fechaDesde) {
      /* ─── Sólo “desde” ────────────────────────────────── */
      queryBuilder.andWhere('comanda.createdAt >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    } else if (filtros.fechaHasta) {
      /* ─── Sólo “hasta” ────────────────────────────────── */
      queryBuilder.andWhere('comanda.createdAt <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }
  }

  /**
   * Actualiza automáticamente los campos prepagoARSID y prepagoUSDID de todas las comandas
   * usando heurísticas complejas para determinar qué prepago se usó históricamente
   */
  async actualizarPrepagosComandas(): Promise<{
    totalComandas: number;
    comandasActualizadas: number;
    comandasConSeñas: number;
    errores: string[];
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener todas las comandas que no estén canceladas
      const comandas = await queryRunner.manager.find(Comanda, {
        where: {
          estadoDeComanda: Not(EstadoDeComanda.CANCELADA),
        },
        relations: ['cliente', 'cliente.prepagosGuardados'],
        order: {
          createdAt: 'ASC', // Procesar en orden cronológico
        },
      });

      let comandasActualizadas = 0;
      let comandasConSeñas = 0;
      const errores: string[] = [];

      for (const comanda of comandas) {
        try {
          if (!comanda.cliente) {
            continue; // Saltar comandas sin cliente
          }

          // Buscar prepagos guardados utilizados del cliente
          const prepagosUtilizados = comanda.cliente.prepagosGuardados.filter(
            (pg) => pg.estado === EstadoPrepago.UTILIZADA,
          );

          if (prepagosUtilizados.length === 0) {
            continue; // El cliente no tiene señas utilizadas
          }

          comandasConSeñas++;

          // HEURÍSTICA COMPLEJA: Determinar qué prepago se usó para esta comanda
          let prepagoARSId: string | null = null;
          let prepagoUSDId: string | null = null;

          // Estrategia 1: Buscar prepagos por proximidad temporal y monto
          const prepagosARS = prepagosUtilizados.filter(
            (pg) => pg.moneda === TipoMoneda.ARS,
          );
          const prepagosUSD = prepagosUtilizados.filter(
            (pg) => pg.moneda === TipoMoneda.USD,
          );

          // Para ARS: Buscar el prepago más reciente antes de la comanda
          if (prepagosARS.length > 0) {
            const prepagoARS = this.encontrarPrepagoMasApropiado(
              prepagosARS,
              comanda.createdAt,
              comanda.precioPesos,
            );
            if (prepagoARS) {
              prepagoARSId = prepagoARS.id;
            }
          }

          // Para USD: Buscar el prepago más reciente antes de la comanda
          if (prepagosUSD.length > 0) {
            const prepagoUSD = this.encontrarPrepagoMasApropiado(
              prepagosUSD,
              comanda.createdAt,
              comanda.precioDolar,
            );
            if (prepagoUSD) {
              prepagoUSDId = prepagoUSD.id;
            }
          }

          // Solo actualizar si hay cambios
          let comandaActualizada = false;

          if (prepagoARSId !== comanda.prepagoARSID) {
            comanda.prepagoARSID = prepagoARSId || undefined;
            comandaActualizada = true;
          }

          if (prepagoUSDId !== comanda.prepagoUSDID) {
            comanda.prepagoUSDID = prepagoUSDId || undefined;
            comandaActualizada = true;
          }

          if (comandaActualizada) {
            await queryRunner.manager.save(Comanda, comanda);
            comandasActualizadas++;

            this.logger.log(
              `Comanda ${comanda.numero} actualizada: prepagoARSID=${prepagoARSId}, prepagoUSDID=${prepagoUSDId}`,
            );
          }
        } catch (error) {
          const errorMsg = `Error procesando comanda ${comanda.numero}: ${error.message}`;
          errores.push(errorMsg);
          this.logger.error(errorMsg, error.stack);
        }
      }

      await queryRunner.commitTransaction();

      return {
        totalComandas: comandas.length,
        comandasActualizadas,
        comandasConSeñas,
        errores,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerMaximoArsUsdEgreso(): Promise<{
    ars: number;
    usd: number;
  }> {
    const comandas = await this.comandaRepository.find({
      where: [
        {
          estadoDeComanda: EstadoDeComanda.PENDIENTE,
          tipoDeComanda: In([TipoDeComanda.INGRESO, TipoDeComanda.EGRESO]),
          caja: Caja.CAJA_1,
          prepagoARSID: Not(IsNull()),
        },
        {
          estadoDeComanda: EstadoDeComanda.PENDIENTE,
          tipoDeComanda: In([TipoDeComanda.INGRESO, TipoDeComanda.EGRESO]),
          caja: Caja.CAJA_1,
          prepagoUSDID: Not(IsNull()),
        },
        {
          estadoDeComanda: EstadoDeComanda.PENDIENTE,
          tipoDeComanda: In([TipoDeComanda.INGRESO, TipoDeComanda.EGRESO]),
          caja: Caja.CAJA_1,
        },
        {
        estadoDeComanda: EstadoDeComanda.VALIDADO,
        tipoDeComanda: In([TipoDeComanda.INGRESO, TipoDeComanda.EGRESO]),
        caja: Caja.CAJA_1,
      },
      ],
      relations: ['prepagoARS', 'prepagoUSD', 'egresos', 'metodosPago'],
    });

    console.log(`DEBUG - Calculando máximo ARS/USD para egresos. Comandas encontradas: ${comandas.length}`);

    const prepagosGuardados = await this.prepagoGuardadoRepository.find({
      where: {
        estado: In([EstadoPrepago.ACTIVA]),
        tipoPago: TipoPago.EFECTIVO,
      },
    });
    const ultimoMovimiento = await this.ultimoMovimiento(true) ?? {
      residualARS: 0,
      residualUSD: 0,
    };

    const comandasIngresos = comandas.filter((c) => c.tipoDeComanda === TipoDeComanda.INGRESO);

    console.log(`DEBUG - Comandas de INGRESO encontradas: ${comandasIngresos.length}`);
    let totalArs = 0;

     comandasIngresos.forEach((c) => {
      const metodoPagoARS = c.metodosPago?.filter((mp) => mp.moneda === TipoMoneda.ARS && mp.tipo === TipoPago.EFECTIVO) || [];
      const totalMetodoPagoARS = metodoPagoARS.reduce((acc, mp) => acc + Number(mp.montoFinal), 0);

      console.log(`DEBUG - Comanda ${c.numero}: totalMetodoPagoARS=${totalMetodoPagoARS}`);

      totalArs += totalMetodoPagoARS;
    });

    let totalUsd = 0;
     comandasIngresos.forEach((c) => {
      const metodoPagoUSD = c.metodosPago?.filter((mp) => mp.moneda === TipoMoneda.USD && mp.tipo === TipoPago.EFECTIVO) || [];
      const totalMetodoPagoUSD = metodoPagoUSD.reduce((acc, mp) => acc + Number(mp.montoFinal), 0);

      console.log(`DEBUG - Comanda ${c.numero}: totalMetodoPagoUSD=${totalMetodoPagoUSD}`);

      totalUsd += totalMetodoPagoUSD;
    });

    // Calcular egresos solo de CAJA_1 (sumar los montos de los egresos individuales)
    let totalEgresosARS = 0;
    let totalEgresosUSD = 0;

    comandas
      .filter((c) => c.tipoDeComanda === TipoDeComanda.EGRESO)
      .forEach((c) => {
        (c.egresos || []).forEach((egreso) => {
          // Solo contar egresos de CAJA_1
          if (egreso.caja === Caja.CAJA_1) {
            if (egreso.moneda === TipoMoneda.ARS) {
              totalEgresosARS += Number(egreso.totalPesos ?? 0);
            } else if (egreso.moneda === TipoMoneda.USD) {
              totalEgresosUSD += Number(egreso.totalDolar ?? 0);
            }
          }
        });
      });

    const totalPrepagosARS = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.ARS)
      .reduce(
        (acc, pg) => acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
        0,
      );
    const totalPrepagosUSD = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.USD)
      .reduce(
        (acc, pg) => acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
        0,
      );

    console.table({
      totalArs: totalArs,
      totalEgresosARS: totalEgresosARS,
      totalPrepagosARS: totalPrepagosARS,
      residualARS: Number(ultimoMovimiento?.residualARS ?? 0),
      totalUsd: totalUsd,
      totalEgresosUSD: totalEgresosUSD,
      totalPrepagosUSD: totalPrepagosUSD,
      residualUSD: Number(ultimoMovimiento?.residualUSD ?? 0),
    });

    return {
      ars:
        totalArs -
        totalEgresosARS +
        totalPrepagosARS +
        Number(ultimoMovimiento?.residualARS ?? 0),
      usd:
        totalUsd -
        totalEgresosUSD +
        totalPrepagosUSD +
        Number(ultimoMovimiento?.residualUSD ?? 0),
    };
  }

  async ultimoMovimiento(controlled: boolean): Promise<Partial<Movimiento>> {
    const ultimoMovimiento = await this.movimientoRepository
      .createQueryBuilder('mov')
      .innerJoinAndSelect('mov.comandas', 'comanda') // al menos 1 comanda
      .where('mov.esIngreso = :ing', { ing: true })
      .orderBy('mov.createdAt', 'DESC')
      .getOne();

    if (!ultimoMovimiento) {
      if (controlled) {
        return {
          residualARS: 0,
          residualUSD: 0,
        };
      }
      throw new NotFoundException('No se encontró el último movimiento');
    }

    return ultimoMovimiento;
  }

  /**
   * Heurística para encontrar el prepago más apropiado para una comanda
   * basándose en proximidad temporal y similitud de montos
   */
  private encontrarPrepagoMasApropiado(
    prepagos: PrepagoGuardado[],
    fechaComanda: Date,
    montoComanda: number,
  ): PrepagoGuardado | null {
    if (prepagos.length === 0) return null;
    if (prepagos.length === 1) return prepagos[0];

    // Ordenar por fecha de creación (más reciente primero)
    const prepagosOrdenados = [...prepagos].sort(
      (a, b) =>
        new Date(b.fechaCreacion).getTime() -
        new Date(a.fechaCreacion).getTime(),
    );

    // Estrategia 1: Buscar prepago con fecha más cercana ANTES de la comanda
    const prepagosAntes = prepagosOrdenados.filter(
      (pg) => new Date(pg.fechaCreacion) <= fechaComanda,
    );

    if (prepagosAntes.length > 0) {
      // Estrategia 2: Si hay múltiples, priorizar por similitud de monto
      const prepagoPorMonto = prepagosAntes.find(
        (pg) => Math.abs(pg.monto - montoComanda) < 1000, // Tolerancia de 1000 unidades
      );

      if (prepagoPorMonto) {
        return prepagoPorMonto;
      }

      // Si no hay coincidencia de monto, tomar el más reciente antes de la comanda
      return prepagosAntes[0];
    }

    // Si no hay prepagos antes de la comanda, tomar el más reciente en general
    return prepagosOrdenados[0];
  }

  /**
   * Calcula las comisiones de los trabajadores en un rango de fechas
   * @param fechaDesde - Fecha de inicio del rango
   * @param fechaHasta - Fecha de fin del rango
   * @returns Resumen de comisiones por trabajador con totales generales
   */
  async calcularComisionesTrabajadores(filtros: FiltrarComisionesDto): Promise<{
    fechaDesde: string;
    fechaHasta: string;
    trabajadores: Array<{
      trabajadorId: string;
      nombre: string;
      totalServicios: number;
      totalProductos: number;
      comisiones: {
        servicios: number;
        productos: number;
        total: number;
      };
    }>;
    totales: {
      serviciosSinDescuento: number;
      serviciosConDescuento: number;
      productosSinDescuento: number;
      productosConDescuento: number;
      totalSinDescuento: number;
      totalConDescuento: number;
    };
    totalComisiones: number;
  }> {
    const tz = 'America/Argentina/Buenos_Aires';

    // Determinar rango de fechas
    let fechaDesde: DateTime;
    let fechaHasta: DateTime;

    if (filtros.fechaDesde) {
      fechaDesde = DateTime.fromISO(filtros.fechaDesde, { zone: tz }).startOf('day');
    } else {
      fechaDesde = DateTime.now().setZone(tz).startOf('day');
    }

    if (filtros.fechaHasta) {
      fechaHasta = DateTime.fromISO(filtros.fechaHasta, { zone: tz }).endOf('day');
    } else {
      fechaHasta = fechaDesde.endOf('day');
    }

    // Consultar comandas en el rango de fechas
    const comandas = await this.comandaRepository.find({
      where: {
        caja: Caja.CAJA_1,
        createdAt: Between(fechaDesde.toJSDate(), fechaHasta.toJSDate()),
        tipoDeComanda: TipoDeComanda.INGRESO,
        estadoDeComanda: In([
          EstadoDeComanda.VALIDADO,
          EstadoDeComanda.PENDIENTE,
          EstadoDeComanda.TRASPASADA,
        ]),
      },
      relations: [
        'items',
        'items.trabajador',
        'items.productoServicio',
        'items.productoServicio.unidadNegocio',
      ],
    });

    // Estructura para almacenar totales por trabajador
    const totalesPorTrabajador = new Map<string, {
      trabajadorId: string;
      nombre: string;
      totalServicios: number;
      totalProductos: number;
      cantidadConsultas: number;
      totalConsultas: number;
      unidadesNegocio: Map<string, number>; // nombre unidad -> cantidad
      productosServicios: Map<string, { cantidad: number; tipo: string }>; // nombre producto/servicio -> {cantidad, tipo}
    }>();

    // Totales generales
    let totalServiciosSinDescuento = 0;
    let totalServiciosConDescuento = 0;
    let totalProductosSinDescuento = 0;
    let totalProductosConDescuento = 0;

    // Procesar cada comanda y sus items
    comandas.forEach((comanda) => {
      comanda.items?.forEach((item) => {
        if (!item.trabajador || !item.productoServicio) {
          return; // Skip items sin trabajador o producto/servicio
        }

        const trabajadorId = item.trabajador.id;
        const nombre = item.trabajador.nombre;
        const tipo = item.productoServicio.tipo;
        const unidadNegocio = item.productoServicio.unidadNegocio?.nombre;

        // Verificar si es Rosario con consultas
        const esRosarioConConsulta = nombre === 'Rosario' && unidadNegocio === 'Consultas';

        // Calcular precio en ARS
        let precio = Number(item.precio ?? 0);
        const cantidad = Number(item.cantidad ?? 1);
        const descuento = Number(item.descuento ?? 0);

        // Si el precio está congelado, usar precioFijoARS; de lo contrario, convertir USD a ARS
        const esPrecioCongelado = item.productoServicio?.esPrecioCongelado;
        const precioFijoARS = Number(item.productoServicio?.precioFijoARS ?? 0);

        // Si el precio está congelado, usar el precio fijo en ARS
        if (esPrecioCongelado && precioFijoARS > 0) {
          precio = precioFijoARS;
        } else {
          // Si no está congelado, el precio está en USD y debe convertirse a ARS
          // Si se proporciona un valorDolar en los filtros, usarlo; de lo contrario, usar el de la comanda
          const valorDolar = filtros.dolar && filtros.dolar > 0
            ? filtros.dolar
            : Number(comanda.valorDolar ?? 1);
          precio = precio * valorDolar; // Convertir USD a ARS
        }

        // Inicializar o actualizar totales del trabajador
        if (!totalesPorTrabajador.has(trabajadorId)) {
          totalesPorTrabajador.set(trabajadorId, {
            trabajadorId,
            nombre,
            totalServicios: 0,
            totalProductos: 0,
            cantidadConsultas: 0,
            totalConsultas: 0,
            unidadesNegocio: new Map(),
            productosServicios: new Map(),
          });
        }

        const trabajadorData = totalesPorTrabajador.get(trabajadorId)!;

        // Contabilizar unidad de negocio
        if (unidadNegocio) {
          const unidadActual = trabajadorData.unidadesNegocio.get(unidadNegocio) || 0;
          trabajadorData.unidadesNegocio.set(unidadNegocio, unidadActual + cantidad);
        }

        // Contabilizar producto/servicio
        const nombreProductoServicio = item.productoServicio.nombre;
        const productoActual = trabajadorData.productosServicios.get(nombreProductoServicio);
        if (productoActual) {
          productoActual.cantidad += cantidad;
        } else {
          trabajadorData.productosServicios.set(nombreProductoServicio, {
            cantidad,
            tipo: tipo === TipoProductoServicio.SERVICIO ? 'SERVICIO' : 'PRODUCTO',
          });
        }

        // Si es Rosario con consultas, solo contar las consultas
        if (esRosarioConConsulta) {
          trabajadorData.cantidadConsultas += cantidad;
          trabajadorData.totalConsultas = trabajadorData.cantidadConsultas * 10;
          // No sumar a los totales generales ni al trabajador
          return;
        }

        // Calcular subtotal en ARS
        const subtotal = (precio * cantidad) - descuento;

        // Aplicar -10% (multiplicar por 0.9)
        const subtotalConDescuento = subtotal * 0.9;

        // Acumular totales generales
        if (tipo === TipoProductoServicio.SERVICIO) {
          totalServiciosSinDescuento += subtotal;
          totalServiciosConDescuento += subtotalConDescuento;
        } else if (tipo === TipoProductoServicio.PRODUCTO) {
          totalProductosSinDescuento += subtotal;
          totalProductosConDescuento += subtotalConDescuento;
        }

        // Sumar al total correspondiente según el tipo
        if (tipo === TipoProductoServicio.SERVICIO) {
          trabajadorData.totalServicios += subtotalConDescuento;
        } else if (tipo === TipoProductoServicio.PRODUCTO) {
          trabajadorData.totalProductos += subtotalConDescuento;
        }
      });
    });

    // Calcular comisiones para cada trabajador
    const trabajadores = Array.from(totalesPorTrabajador.values()).map((trabajadorData) => {
      // Comisiones: 30% de servicios, 10% de productos
      const comisionServicios = trabajadorData.totalServicios * 0.30;
      const comisionProductos = trabajadorData.totalProductos * 0.10;
      const totalComision = comisionServicios + comisionProductos;

      // Convertir Map de unidades de negocio a objeto
      const unidadesNegocio: Record<string, number> = {};
      trabajadorData.unidadesNegocio.forEach((cantidad, nombre) => {
        unidadesNegocio[nombre] = cantidad;
      });

      // Convertir Map de productos/servicios a array de objetos
      const productosServicios: Array<{ nombre: string; cantidad: number; tipo: string }> = [];
      trabajadorData.productosServicios.forEach((data, nombre) => {
        productosServicios.push({
          nombre,
          cantidad: data.cantidad,
          tipo: data.tipo,
        });
      });

      return {
        trabajadorId: trabajadorData.trabajadorId,
        nombre: trabajadorData.nombre,
        totalServicios: Number(trabajadorData.totalServicios.toFixed(2)),
        totalProductos: Number(trabajadorData.totalProductos.toFixed(2)),
        cantidadConsultas: trabajadorData.cantidadConsultas,
        totalConsultas: Number(trabajadorData.totalConsultas.toFixed(2)),
        unidadesNegocio,
        productosServicios,
        comisiones: {
          servicios: Number(comisionServicios.toFixed(2)),
          productos: Number(comisionProductos.toFixed(2)),
          total: Number(totalComision.toFixed(2)),
        },
      };
    });

    // Calcular total general de comisiones
    const totalComisiones = trabajadores.reduce(
      (sum, t) => sum + t.comisiones.total,
      0,
    );

    // Calcular totales generales
    const totalSinDescuento = totalServiciosSinDescuento + totalProductosSinDescuento;
    const totalConDescuento = totalServiciosConDescuento + totalProductosConDescuento;

    return {
      fechaDesde: fechaDesde.toISO() || fechaDesde.toString(),
      fechaHasta: fechaHasta.toISO() || fechaHasta.toString(),
      trabajadores,
      totales: {
        serviciosSinDescuento: Number(totalServiciosSinDescuento.toFixed(2)),
        serviciosConDescuento: Number(totalServiciosConDescuento.toFixed(2)),
        productosSinDescuento: Number(totalProductosSinDescuento.toFixed(2)),
        productosConDescuento: Number(totalProductosConDescuento.toFixed(2)),
        totalSinDescuento: Number(totalSinDescuento.toFixed(2)),
        totalConDescuento: Number(totalConDescuento.toFixed(2)),
      },
      totalComisiones: Number(totalComisiones.toFixed(2)),
    };
  }
}
