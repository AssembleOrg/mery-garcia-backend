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
} from 'typeorm';
import { DateTime } from 'luxon';
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
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { EstadoPrepago } from 'src/enums/EstadoPrepago.enum';
import { ItemComanda } from './entities/ItemComanda.entity';
import { Descuento } from './entities/descuento.entity';
import { ProductoServicio } from './entities/productoServicio.entity';
import { Caja } from 'src/enums/Caja.enum';
import { Egreso } from './entities/egreso.entity';
import { CrearEgresoDto } from './dto/crear-egreso.dto';
import { TipoMoneda } from 'src/enums/TipoMoneda.enum';
import { TipoItem } from './entities/TipoItem.entity';
import { TipoPago } from 'src/enums/TipoPago.enum';
import { Movimiento } from './entities/movimiento.entity';

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
    private dataSource: DataSource,
    private auditoriaService: AuditoriaService,
    @InjectRepository(Movimiento)
    private movimientoRepository: Repository<Movimiento>,
  ) {}

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
      .leftJoinAndSelect('comanda.items', 'items')
      .leftJoinAndSelect('items.metodosPago', 'metodosPago')
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

      // 6. Actualizar descuentos solo si se proporcionan
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

      // 7. Guardar la comanda actualizada
      const comandaActualizada = await queryRunner.manager.save(
        Comanda,
        comanda,
      );

      // 7.1. Enforzar en BD que los prepagos queden en NULL si los flags son false
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
      let comanda = new Comanda();
      comanda.numero = crearEgresoDto.numero;
      comanda.tipoDeComanda = TipoDeComanda.EGRESO;
      comanda.estadoDeComanda =
        crearEgresoDto.estadoDeComanda ?? EstadoDeComanda.FINALIZADA;
      comanda.observaciones = crearEgresoDto.observaciones;
      comanda.caja = Caja.CAJA_1;
      comanda.precioDolar = crearEgresoDto.precioDolar;
      comanda.precioPesos = crearEgresoDto.precioPesos;
      comanda.valorDolar = crearEgresoDto.valorDolar;
      comanda.creadoPor = { id: crearEgresoDto.creadoPorId } as Personal;

      const sumaEgresosDolar = crearEgresoDto.egresos?.reduce((acc, egreso) => {
        return acc + egreso.totalDolar;
      }, 0);

      const sumaEgresosPesos = crearEgresoDto.egresos?.reduce((acc, egreso) => {
        return acc + egreso.totalPesos;
      }, 0);

      const netoCajaChica = await this.obtenerMaximoArsUsdEgreso();
      if (
        sumaEgresosDolar! > netoCajaChica.usd &&
        crearEgresoDto.egresos?.some(
          (egreso) => egreso.moneda === TipoMoneda.USD,
        )
      ) {
        throw new BadRequestException(
          'La caja 1 no tiene suficientes dolares para realizar el egreso',
        );
      }
      if (
        sumaEgresosPesos! > netoCajaChica.ars &&
        crearEgresoDto.egresos?.some(
          (egreso) => egreso.moneda === TipoMoneda.ARS,
        )
      ) {
        throw new BadRequestException(
          'La caja 1 no tiene suficientes pesos para realizar el egreso',
        );
      }

      const egresos = crearEgresoDto.egresos?.map((egreso) => {
        const egresoEntity = new Egreso();
        egresoEntity.total = egreso.total;
        egresoEntity.totalDolar = egreso.totalDolar;
        egresoEntity.totalPesos = egreso.totalPesos;
        egresoEntity.valorDolar = egreso.valorDolar;
        egresoEntity.moneda = egreso.moneda;
        return queryRunner.manager.create(Egreso, egresoEntity);
      });
      comanda.egresos = await Promise.all(egresos ?? []);

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
      ],
    });
    console.log(comandas.length, 'comandasLength');
    type Totals = { usd: number; ars: number };

    const totals: Totals = comandas.reduce<Totals>(
      (acc, comanda) => {
        const comandaHasUSD =
          comanda.items?.some((item) =>
            item.metodosPago?.some((mp) => mp.moneda === 'USD'),
          ) ?? false;

        comanda.items?.forEach((item) => {
          item.metodosPago?.forEach((mp) => {
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
    return await this.comandaRepository.findOne({
      where: {
        caja: Caja.CAJA_1,
        tipoDeComanda: TipoDeComanda.EGRESO,
      },
      order: { createdAt: 'DESC' },
      select: {
        numero: true,
      },
    });
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
        relations: ['egresos', 'prepagoARS', 'prepagoUSD'],
      });
      prepagosGuardados = await this.prepagoGuardadoRepository.find({
        where: {
          estado: In([EstadoPrepago.ACTIVA]),
          fechaCreacion: Raw((a) => `${a} >= :from AND ${a} < :to`, {
            from: fechaDesde,
            to: fechaHasta,
          }),
        },
      });
      ultimoMovimiento = await this.movimientoRepository.findOne({
        where: {
          id: Not(IsNull()),
          createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
            from: fechaDesde,
            to: fechaHasta,
          }),
          esIngreso: true,
          comandas: Not(IsNull()),
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
        relations: ['egresos', 'prepagoARS', 'prepagoUSD'],
      });
      prepagosGuardados = await this.prepagoGuardadoRepository.find({
        where: {
          estado: In([EstadoPrepago.ACTIVA]),
        },
      });
      ultimoMovimiento = await this.ultimoMovimiento(true);
    }

    comandasValidadasIds = comandas.reduce<string[]>((acc, c) => {
      if (c.estadoDeComanda === EstadoDeComanda.VALIDADO) {
        acc.push(c.id);
      }
      return acc;
    }, []);

    // console.log(comandas.length, 'comandas');
    // console.log(
    //   prepagosGuardados.filter((pg) => pg.estado === EstadoPrepago.ACTIVA)
    //     .length,
    //   'prepagosGuardados activos',
    //   prepagosGuardados.filter((pg) => pg.estado === EstadoPrepago.ACTIVA),
    // );
    // console.log(
    //   prepagosGuardados.filter((pg) => pg.estado === EstadoPrepago.UTILIZADA)
    //     .length,
    //   'prepagosGuardados utilizados',
    // );

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
          const totalIngresosARS = Number(comanda.precioPesos) + Number(comanda.prepagoARS?.monto ?? 0);
          const totalIngresosUSD = Number(comanda.precioDolar) + Number(comanda.prepagoUSD?.monto ?? 0);
          // this.logger.fatal(totalIngresosARS, 'totalIngresosARS2');
          // this.logger.fatal(totalIngresosUSD, 'totalIngresosUSD2');
          acc.totalIngresosARS +=
            totalIngresosARS 
            // this.logger.fatal(acc.totalIngresosARS, 'totalIngresosARS3');
          acc.totalIngresosUSD +=
            totalIngresosUSD 
          acc.montoNetoARS += acc.totalIngresosARS - acc.totalEgresosARS;
          acc.montoNetoUSD += acc.totalIngresosUSD - acc.totalEgresosUSD;
        }

        /* ---------- Acumulados ---------- */

        // if (
        //   comanda.estadoDeComanda === EstadoDeComanda.VALIDADO &&
        //   comanda.tipoDeComanda === TipoDeComanda.INGRESO
        // ) {
        //   acc.montoNetoARSValidado += Number(comanda.precioPesos) + (Number(comanda.prepagoARS?.monto) ?? 0);
        //   acc.montoNetoUSDValidado += Number(comanda.precioDolar) + (Number(comanda.prepagoUSD?.monto) ?? 0);
        // }

        // acc.totalTransaccionesARS += Number(comanda.precioPesos) + (Number(comanda.prepagoARS?.monto) ?? 0);
        // acc.totalTransaccionesUSD += Number(comanda.precioDolar) + (Number(comanda.prepagoUSD?.monto) ?? 0);

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
      console.table({
        montoSeñasARS: noComandasValues.montoSeñasARS,
        montoSeñasUSD: noComandasValues.montoSeñasUSD,
      });
    }

    const totalPrepagosARS = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.ARS)
      .reduce(
        (acc, pg) =>
          acc + (Number(pg.monto) - Number(pg.montoTraspasado ?? 0)),
        0,
      );
    const totalPrepagosUSD = prepagosGuardados
      .filter((pg) => pg.moneda === TipoMoneda.USD)
      .reduce(
        (acc, pg) =>
          acc + (Number(pg.monto) - Number(pg.montoTraspasado ?? 0)),
        0,
      );

    console.table({
      totalIngresosARS: helperComandas.totalIngresosARS + totalPrepagosARS,
      totalIngresosUSD: helperComandas.totalIngresosUSD + totalPrepagosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      montoNetoARS: helperComandas.montoNetoARS,
      montoNetoUSD: helperComandas.montoNetoUSD,
      prepagosARS: totalPrepagosARS,
      prepagosUSD: totalPrepagosUSD,
      prepagosTraspasadosARS: prepagosGuardados
        .filter((pg) => pg.moneda === TipoMoneda.ARS)
        .reduce((acc, pg) => acc + Number(pg.montoTraspasado ?? 0), 0),
      prepagosTraspasadosUSD: prepagosGuardados
        .filter((pg) => pg.moneda === TipoMoneda.USD)
        .reduce((acc, pg) => acc + Number(pg.montoTraspasado ?? 0), 0),
      prepagosNoTraspasadosARS: prepagosGuardados
        .filter((pg) => pg.moneda === TipoMoneda.ARS)
        .reduce(
          (acc, pg) =>
            acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
          0,
        ),
      prepagosNoTraspasadosUSD: prepagosGuardados
        .filter((pg) => pg.moneda === TipoMoneda.USD)
        .reduce(
          (acc, pg) =>
            acc + Number(pg.monto) - Number(pg.montoTraspasado ?? 0),
          0,
        ),
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
        Number(ultimoMovimiento?.residualUSD ?? 0) +
        noComandasValues.montoSeñasUSD,
      totalIngresosARS:
        helperComandas.totalIngresosARS + totalPrepagosARS +
        Number(ultimoMovimiento?.residualARS ?? 0) +
        noComandasValues.montoSeñasARS,
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      comandasValidadasIds,
    };
  }

  async getResumenCajaPorMetodoPago(filtros: {
    fecha?: string;
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
  }> {
    // Use today's date if not provided
    const hoy = DateTime.now().setZone('America/Argentina/Buenos_Aires');
    
    // Parse the provided date or use today
    const fechaSeleccionada = filtros.fecha 
      ? DateTime.fromISO(filtros.fecha, { zone: 'America/Argentina/Buenos_Aires' })
      : hoy;
    
    // Get start and end of the selected day
    const fechaDesde = fechaSeleccionada.startOf('day').toJSDate();
    const fechaHasta = fechaSeleccionada.endOf('day').toJSDate();
    
    console.log('DEBUG - Fecha solicitada:', filtros.fecha);
    console.log('DEBUG - Fecha seleccionada:', fechaSeleccionada.toISO());
    console.log('DEBUG - Fecha desde:', fechaDesde);
    console.log('DEBUG - Fecha hasta:', fechaHasta);
    
    let comandasValidadasIds: string[] = [];

    const comandas = await this.comandaRepository.find({
      where: {
        estadoDeComanda: In([
          EstadoDeComanda.VALIDADO,
          EstadoDeComanda.PENDIENTE,
          EstadoDeComanda.TRASPASADA,
        ]),
        caja: Caja.CAJA_1,
        createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
          from: fechaDesde,
          to: fechaHasta,
        }),
      },
      relations: ['egresos', 'prepagoARS', 'prepagoUSD', 'items', 'items.metodosPago'],
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
    
    console.log('DEBUG - Comandas encontradas:', comandas.length);
    console.log('DEBUG - Prepagos guardados encontrados:', prepagosGuardados.length);
    
    const ultimoMovimiento = await this.movimientoRepository.findOne({
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
    }

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
    };

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
          comanda.tipoDeComanda === TipoDeComanda.INGRESO
        ) {
          // NO sumamos prepagos aquí porque ya se sumaron cuando se crearon
          // Solo sumamos lo que realmente ingresó en esta comanda
          const totalIngresosARS = Number(comanda.precioPesos);
          const totalIngresosUSD = Number(comanda.precioDolar);
          
          acc.totalIngresosARS += totalIngresosARS;
          acc.totalIngresosUSD += totalIngresosUSD;

          /* ---------- Process payment methods by type (INGRESOS) ---------- */
          if (comanda.items && comanda.items.length > 0) {
            comanda.items.forEach((item) => {
              if (item.metodosPago && item.metodosPago.length > 0) {
                item.metodosPago.forEach((metodoPago) => {
                  const montoFinal = Number(metodoPago.montoFinal ?? 0);
                  const tipoMoneda = metodoPago.moneda;
                  const tipoPago = metodoPago.tipo;

                  if (tipoMoneda === TipoMoneda.ARS) {
                    porMetodoPago[tipoPago].ARS += montoFinal - (Number(comanda.prepagoARS?.monto ?? 0));
                  } else if (tipoMoneda === TipoMoneda.USD) {
                    porMetodoPago[tipoPago].USD += montoFinal - (Number(comanda.prepagoUSD?.monto ?? 0));
                  }
                });
              }
            });
          }
        }

        /* ---------- Egresos - Process payment methods by type ---------- */
        if (
          comanda.tipoDeComanda === TipoDeComanda.EGRESO
        ) {
          if (comanda.items && comanda.items.length > 0) {
            comanda.items.forEach((item) => {
              if (item.metodosPago && item.metodosPago.length > 0) {
                item.metodosPago.forEach((metodoPago) => {
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
            });
          }
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
              acc + Number(pg.monto) ,
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

    // Add prepago guardado amounts to payment method breakdown
    prepagosGuardados.forEach((prepago) => {
      const monto = Number(prepago.monto ?? 0);
      const tipoMoneda = prepago.moneda;
      const tipoPago = prepago.tipoPago;
      
      // console.log('DEBUG - Prepago guardado:', { tipoPago, tipoMoneda, monto });

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

    // Solo ingresos brutos, sin restar egresos
    const totalIngresosUSD = 
      helperComandas.totalIngresosUSD + 
      totalPrepagosUSD +
      Number(ultimoMovimiento?.residualUSD ?? 0) +
      noComandasValues.montoSeñasUSD;
      
    const totalIngresosARS = 
      helperComandas.totalIngresosARS + 
      totalPrepagosARS +
      Number(ultimoMovimiento?.residualARS ?? 0) +
      noComandasValues.montoSeñasARS;

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
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      comandasValidadasIds,
      porMetodoPago,
      porMetodoPagoEgresos,
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
      queryBuilder.andWhere('servicio.id = :servicioId', {
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
    let comandas = await this.comandaRepository.find({
      where: {
        estadoDeComanda: EstadoDeComanda.VALIDADO,
        tipoDeComanda: In([TipoDeComanda.INGRESO, TipoDeComanda.EGRESO]),
        caja: Caja.CAJA_1,
      },
      relations: ['prepagoARS', 'prepagoUSD', 'egresos'],
    });

    const comandasPendientes = await this.comandaRepository.find({
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
      ],
      relations: ['prepagoARS', 'prepagoUSD', 'egresos'],
    });
    console.log(comandasPendientes.length, 'comandasPendientes');
    comandas = comandas.concat(comandasPendientes);
    console.log(comandas.length, 'comandas');

    const prepagosGuardados = await this.prepagoGuardadoRepository.find({
      where: {
        estado: In([EstadoPrepago.ACTIVA]),
      },
    });
    const ultimoMovimiento = await this.ultimoMovimiento(true) ?? {
      residualARS: 0,
      residualUSD: 0,
    };

    const totalArs = comandas
      .filter((c) => c.tipoDeComanda === TipoDeComanda.INGRESO)
      .reduce((acc, c) => acc + Number(c.precioPesos) + Number(c.prepagoARS?.monto ?? 0), 0);
    const totalUsd = comandas
      .filter((c) => c.tipoDeComanda === TipoDeComanda.INGRESO)
      .reduce((acc, c) => acc + Number(c.precioDolar) + Number(c.prepagoUSD?.monto ?? 0), 0);
    const totalEgresosARS = comandas
      .filter((c) => c.tipoDeComanda === TipoDeComanda.EGRESO)
      .reduce((acc, c) => acc + Number(c.precioPesos), 0);
    const totalEgresosUSD = comandas
      .filter((c) => c.tipoDeComanda === TipoDeComanda.EGRESO)
      .reduce((acc, c) => acc + Number(c.precioDolar), 0);

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
      residualARS: ultimoMovimiento?.residualARS ?? 0,
      totalUsd: totalUsd,
      totalEgresosUSD: totalEgresosUSD,
      totalPrepagosUSD: totalPrepagosUSD,
      residualUSD: ultimoMovimiento?.residualUSD ?? 0,
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
}
