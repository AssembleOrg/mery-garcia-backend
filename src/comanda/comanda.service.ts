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
} from 'typeorm';
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
import { ActualizarComandaDto } from './dto/actualizar-comanda.dto';
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
      comanda.usuarioConsumePrepago = crearComandaDto.usuarioConsumePrepago;

      if (crearComandaDto.clienteId) {
        const cliente = await queryRunner.manager.findOne(Cliente, {
          where: { id: crearComandaDto.clienteId },
        });
        if (!cliente) {
          throw new NotFoundException(`Cliente no encontrado`);
        }
        if (crearComandaDto.usuarioConsumePrepago) {
          //consumir prepago
          const prepago = await queryRunner.manager.findOne(PrepagoGuardado, {
            where: {
              cliente: { id: crearComandaDto.clienteId },
              estado: EstadoPrepago.ACTIVA,
            },
          });
          if (!prepago) {
            throw new NotFoundException(`La seña ya fue consumida`);
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
        if (crearComandaDto.items.some((item) => !item.trabajadorId)) {
          throw new BadRequestException(
            'El trabajador es requerido para cada item',
          );
        }
        if (crearComandaDto.items.some((item) => !item.productoServicioId)) {
          throw new BadRequestException(
            'El producto es requerido para cada item',
          );
        }
        const itemsComanda = crearComandaDto.items.map((item) => {
          const itemComanda = new ItemComanda();
          itemComanda.nombre = item.nombre;
          itemComanda.precio = item.precio;
          itemComanda.cantidad = item.cantidad;
          itemComanda.descuento = item.descuento ?? 0;
          itemComanda.subtotal = item.subtotal ?? 0;
          itemComanda.trabajador = { id: item.trabajadorId! } as Trabajador;
          itemComanda.productoServicio = {
            id: item.productoServicioId!,
          } as ProductoServicio;
          return queryRunner.manager.save(ItemComanda, itemComanda);
        });

        comanda.items = await Promise.all(itemsComanda);

        if (
          crearComandaDto.descuentosAplicados &&
          crearComandaDto.descuentosAplicados.length > 0
        ) {
          const descuentos = crearComandaDto.descuentosAplicados.map(
            (descuento) => {
              const descuentoComanda = new Descuento();
              descuentoComanda.montoFijo = descuento.montoFijo;
              descuentoComanda.porcentaje = descuento.porcentaje;
              descuentoComanda.nombre = descuento.nombre;
              descuentoComanda.comanda = comanda;
              return queryRunner.manager.save(Descuento, descuentoComanda);
            },
          );

          comanda.descuentosAplicados = await Promise.all(descuentos);
        }
      }

      if (
        crearComandaDto.metodosPago &&
        crearComandaDto.metodosPago.length > 0
      ) {
        const metodosPago = crearComandaDto.metodosPago.map((metodoPago) => {
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
        });

        comanda.metodosPago = await Promise.all(metodosPago);
      }

      comanda = await queryRunner.manager.save(Comanda, comanda);

      await queryRunner.commitTransaction();

      return await this.obtenerPorId(comanda.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
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
        'items.productoServicio',
        'items.trabajador',
        'descuentosAplicados',
        'items.productoServicio.unidadNegocio',
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
      .leftJoinAndSelect('comanda.creadoPor', 'creadoPor')
      .leftJoinAndSelect('comanda.metodosPago', 'metodosPago')
      .leftJoinAndSelect('comanda.items', 'items')
      .leftJoinAndSelect('items.productoServicio', 'productoServicio')
      .leftJoinAndSelect('items.tipo', 'tipo')
      .leftJoinAndSelect('items.trabajador', 'trabajador')
      .leftJoinAndSelect('productoServicio.unidadNegocio', 'unidadNegocio');

    console.log(filtros.incluirTraspasadas);
    if (!filtros.incluirTraspasadas) {
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

    return {
      data: comandas,
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
        'creadoPor',
        'metodosPago',
        'items',
        'items.productoServicio',
        'items.trabajador',
        'descuentosAplicados',
        'egresos',
      ],
    });
    if (!comanda) {
      throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
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
    actualizarComandaDto: CrearComandaDto,
  ): Promise<Comanda> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que la comanda existe
      const comandaExistente = await queryRunner.manager.findOne(Comanda, {
        where: { id },
      });

      if (!comandaExistente) {
        throw new NotFoundException(`Comanda con ID ${id} no encontrada`);
      }

      // 1. Eliminar todas las relaciones existentes
      await queryRunner.manager.delete(ItemComanda, { comanda: { id } });
      await queryRunner.manager.delete(Descuento, { comanda: { id } });
      await queryRunner.manager.delete(MetodoPago, { comanda: { id } });

      // 2. Eliminar la comanda actual
      await queryRunner.manager.delete(Comanda, { id });

      // 3. Crear la comanda completamente nueva con el mismo ID
      let nuevaComanda = new Comanda();
      nuevaComanda.id = id; // Mantener el mismo ID
      nuevaComanda.numero = actualizarComandaDto.numero;
      nuevaComanda.tipoDeComanda = actualizarComandaDto.tipoDeComanda;
      nuevaComanda.estadoDeComanda = actualizarComandaDto.estadoDeComanda;
      nuevaComanda.caja = actualizarComandaDto.caja;
      nuevaComanda.precioDolar = actualizarComandaDto.precioDolar;
      nuevaComanda.precioPesos = actualizarComandaDto.precioPesos;
      nuevaComanda.valorDolar = actualizarComandaDto.valorDolar;
      nuevaComanda.observaciones = actualizarComandaDto.observaciones;
      nuevaComanda.usuarioConsumePrepago = actualizarComandaDto.usuarioConsumePrepago;
      nuevaComanda.createdAt = comandaExistente.createdAt; // Mantener fecha de creación original
      nuevaComanda.updatedAt = new Date(); // Actualizar fecha de modificación

      // 4. Manejar cliente
      if (actualizarComandaDto.clienteId) {
        const cliente = await queryRunner.manager.findOne(Cliente, {
          where: { id: actualizarComandaDto.clienteId },
        });
        if (!cliente) {
          throw new NotFoundException(`Cliente no encontrado`);
        }
        
        if (actualizarComandaDto.usuarioConsumePrepago) {
          // Consumir prepago
          const prepago = await queryRunner.manager.findOne(PrepagoGuardado, {
            where: {
              cliente: { id: actualizarComandaDto.clienteId },
              estado: EstadoPrepago.ACTIVA,
            },
          });
          if (!prepago) {
            throw new NotFoundException(`No hay seña activa disponible`);
          }
          prepago.estado = EstadoPrepago.UTILIZADA;
          await queryRunner.manager.save(PrepagoGuardado, prepago);
        }
        nuevaComanda.cliente = cliente;
      }

      // 5. Manejar creadoPor
      if (actualizarComandaDto.creadoPorId) {
        const creadoPor = await queryRunner.manager.findOne(Personal, {
          where: { id: actualizarComandaDto.creadoPorId },
        });
        if (!creadoPor) {
          throw new NotFoundException(`Personal no encontrado`);
        }
        nuevaComanda.creadoPor = creadoPor;
      }

      // 6. Guardar la nueva comanda
      nuevaComanda = await queryRunner.manager.save(Comanda, nuevaComanda);

      // 7. Crear items si existen
      if (actualizarComandaDto.items && actualizarComandaDto.items.length > 0) {
        if (actualizarComandaDto.items.some((item) => !item.trabajadorId)) {
          throw new BadRequestException(
            'El trabajador es requerido para cada item',
          );
        }
        if (actualizarComandaDto.items.some((item) => !item.productoServicioId)) {
          throw new BadRequestException(
            'El producto es requerido para cada item',
          );
        }
        
        const itemsComanda = actualizarComandaDto.items.map((item) => {
          const itemComanda = new ItemComanda();
          itemComanda.nombre = item.nombre;
          itemComanda.precio = item.precio;
          itemComanda.cantidad = item.cantidad;
          itemComanda.descuento = item.descuento ?? 0;
          itemComanda.subtotal = item.subtotal ?? 0;
          itemComanda.trabajador = { id: item.trabajadorId! } as Trabajador;
          itemComanda.productoServicio = {
            id: item.productoServicioId!,
          } as ProductoServicio;
          itemComanda.comanda = nuevaComanda;
          return queryRunner.manager.save(ItemComanda, itemComanda);
        });

        nuevaComanda.items = await Promise.all(itemsComanda);
      }

      // 8. Crear descuentos si existen
      if (actualizarComandaDto.descuentosAplicados && actualizarComandaDto.descuentosAplicados.length > 0) {
        const descuentos = actualizarComandaDto.descuentosAplicados.map(
          (descuento) => {
            const descuentoComanda = new Descuento();
            descuentoComanda.montoFijo = descuento.montoFijo;
            descuentoComanda.porcentaje = descuento.porcentaje;
            descuentoComanda.nombre = descuento.nombre;
            descuentoComanda.comanda = nuevaComanda;
            return queryRunner.manager.save(Descuento, descuentoComanda);
          },
        );

        nuevaComanda.descuentosAplicados = await Promise.all(descuentos);
      }

      // 9. Crear métodos de pago si existen
      if (actualizarComandaDto.metodosPago && actualizarComandaDto.metodosPago.length > 0) {
        const metodosPago = actualizarComandaDto.metodosPago.map((metodoPago) => {
          const metodoPagoComanda = new MetodoPago();
          metodoPagoComanda.tipo = metodoPago.tipo;
          metodoPagoComanda.monto = metodoPago.monto;
          metodoPagoComanda.montoFinal = metodoPago.montoFinal;
          metodoPagoComanda.descuentoGlobalPorcentaje =
            metodoPago.descuentoGlobalPorcentaje;
          metodoPagoComanda.moneda = metodoPago.moneda;
          metodoPagoComanda.recargoPorcentaje =
            metodoPago.recargoPorcentaje ?? 0;
          metodoPagoComanda.comanda = nuevaComanda;
          return queryRunner.manager.save(MetodoPago, metodoPagoComanda);
        });

        nuevaComanda.metodosPago = await Promise.all(metodosPago);
      }

      await queryRunner.commitTransaction();

      // Registrar auditoría
      await this.auditoriaService.registrar({
        tipoAccion: TipoAccion.COMANDA_MODIFICADA,
        modulo: ModuloSistema.COMANDA,
        entidadId: nuevaComanda.id,
        descripcion: `Comanda actualizada: ${nuevaComanda.numero}`,
      });

      this.logger.log(`Comanda actualizada: ${nuevaComanda.id} - ${nuevaComanda.numero}`);
      
      return await this.obtenerPorId(nuevaComanda.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando comanda: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async eliminar(id: string): Promise<void> {
    const comanda = await this.obtenerPorId(id);
    await this.comandaRepository.softRemove(comanda);

    // Registrar auditoría
    await this.auditoriaService.registrar({
      tipoAccion: TipoAccion.COMANDA_ELIMINADA,
      modulo: ModuloSistema.COMANDA,
      entidadId: comanda.id,
      descripcion: `Comanda eliminada: ${comanda.numero}`,
    });
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

    // Registrar auditoría
    await this.auditoriaService.registrar({
      tipoAccion: TipoAccion.COMANDA_RESTAURADA,
      modulo: ModuloSistema.COMANDA,
      entidadId: comanda.id,
      descripcion: `Comanda restaurada: ${comanda.numero}`,
    });

    return await this.obtenerPorId(id);
  }

  async crearEgreso(crearEgresoDto: CrearEgresoDto): Promise<Comanda> {
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

      const netoCajaChica = await this.netoCajaChica();
      if (
        sumaEgresosDolar! > netoCajaChica.totalIngresosUSD &&
        crearEgresoDto.egresos?.some(
          (egreso) => egreso.moneda === TipoMoneda.USD,
        )
      ) {
        throw new BadRequestException(
          'La caja 1 no tiene suficientes dolares para realizar el egreso',
        );
      }
      if (
        sumaEgresosPesos! > netoCajaChica.totalIngresosARS &&
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

  async getLastComanda(): Promise<Comanda | null> {
    return await this.comandaRepository.findOne({
      where: {
        caja: Caja.CAJA_1,
        tipoDeComanda: TipoDeComanda.INGRESO,
      },
      order: { createdAt: 'DESC' },
      select: {
        numero: true,
      },
    });
  }

  async netoCajaChica(): Promise<{
    totalIngresosARS: number;
    totalIngresosUSD: number;
  }> {
    const comandas = await this.comandaRepository.find({
      where: {
        estadoDeComanda: Not(
          In([EstadoDeComanda.CANCELADA, EstadoDeComanda.PENDIENTE, EstadoDeComanda.TRASPASADA]),
        ),
        caja: Caja.CAJA_1,
      },
      relations: [
        'metodosPago',
        'items',
        'items.productoServicio',
        'items.trabajador',
        'descuentosAplicados',
        'egresos',
      ],
    });

    const totalIngresosARS = comandas.reduce((acc, comanda) => {
      const totalIngresosARS = comanda.metodosPago.reduce((acc, metodoPago) => {
        if (metodoPago.moneda === TipoMoneda.ARS) {
          acc += metodoPago.montoFinal;
        }
        return acc;
      }, 0);
      return acc + totalIngresosARS;
    }, 0);

    const totalIngresosUSD = comandas.reduce((acc, comanda) => {
      const totalIngresosUSD = comanda.metodosPago.reduce((acc, metodoPago) => {
        if (metodoPago.moneda === TipoMoneda.USD) {
          acc += metodoPago.montoFinal;
        }
        return acc;
      }, 0);
      return acc + totalIngresosUSD;
    }, 0);

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
        relations: [
          'metodosPago',
          'items',
          'items.productoServicio',
          'items.trabajador',
          'descuentosAplicados',
          'egresos',
        ],
      });
    } else {
      comandas = await this.comandaRepository.find({
        where: {
          estadoDeComanda: In([
            EstadoDeComanda.VALIDADO,
            EstadoDeComanda.PENDIENTE,
          ]),
          caja: Caja.CAJA_1,
        },
        relations: [
          'metodosPago',
          'items',
          'items.productoServicio',
          'items.trabajador',
          'descuentosAplicados',
          'egresos',
        ],
      });
    }

    comandasValidadasIds = comandas.reduce<string[]>((acc, c) => {
      if (c.estadoDeComanda === EstadoDeComanda.VALIDADO) {
        acc.push(c.id);
      }
      return acc;
    }, []);

    const helperComandas = comandas.reduce(
      (acc, comanda) => {
        const egresos = comanda.egresos ?? [];

        const totalEgresosARS = egresos.reduce((acc, egreso) => {
          if (egreso.moneda === TipoMoneda.ARS) {
            acc += egreso.totalPesos;
          }
          return acc;
        }, 0);
        const totalEgresosUSD = egresos.reduce((acc, egreso) => {
          if (egreso.moneda === TipoMoneda.USD) {
            acc += egreso.totalDolar;
          }

          return acc;
        }, 0);

        acc.totalEgresosARS += totalEgresosARS;
        acc.totalEgresosUSD += totalEgresosUSD;

        if (comanda.estadoDeComanda === EstadoDeComanda.VALIDADO) {
          acc.totalCompletados++;
        } else if (comanda.estadoDeComanda === EstadoDeComanda.PENDIENTE) {
          acc.totalPendientes++;
        }

        const totalIngresosARS = comanda.metodosPago.reduce(
          (acc, metodoPago) => {
            if (metodoPago.moneda === TipoMoneda.ARS) {
              acc.total += metodoPago.monto;
              acc.neto += metodoPago.montoFinal;
            }
            return acc;
          },
          {
            total: 0,
            neto: 0,
            totalTransacciones: 0,
          },
        );
        const totalIngresosUSD = comanda.metodosPago.reduce(
          (acc, metodoPago) => {
            if (metodoPago.moneda === TipoMoneda.USD) {
              acc.total += metodoPago.monto;
              acc.neto += metodoPago.montoFinal;
            }
            return acc;
          },
          {
            total: 0,
            neto: 0,
            totalTransacciones: 0,
          },
        );

        acc.totalIngresosARS += totalIngresosARS.total;
        acc.totalIngresosUSD += totalIngresosUSD.total;
        acc.montoNetoARSValidado +=
          comanda.estadoDeComanda === EstadoDeComanda.VALIDADO
            ? totalIngresosARS.neto
            : 0;
        acc.montoNetoUSDValidado +=
          comanda.estadoDeComanda === EstadoDeComanda.VALIDADO
            ? totalIngresosUSD.neto
            : 0;
        acc.montoNetoARS += totalIngresosARS.neto;
        acc.montoNetoUSD += totalIngresosUSD.neto;
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

    return {
      totalCompletados: helperComandas.totalCompletados,
      totalPendientes: helperComandas.totalPendientes,
      montoNetoUSD:
        helperComandas.montoNetoUSD - helperComandas.totalEgresosUSD,
      montoNetoARS:
        helperComandas.montoNetoARS - helperComandas.totalEgresosARS,
      montoDisponibleTrasladoUSD:
        helperComandas.montoNetoUSDValidado - helperComandas.totalEgresosUSD,
      montoDisponibleTrasladoARS:
        helperComandas.montoNetoARSValidado - helperComandas.totalEgresosARS,
      totalIngresosUSD: helperComandas.totalIngresosUSD,
      totalIngresosARS: helperComandas.totalIngresosARS,
      totalEgresosUSD: helperComandas.totalEgresosUSD,
      totalEgresosARS: helperComandas.totalEgresosARS,
      comandasValidadasIds,
    };
  }

  async cambiarEstado(
    id: string,
    nuevoEstado: EstadoDeComanda,
  ): Promise<Comanda> {
    const comanda = await this.obtenerPorId(id);
    comanda.estadoDeComanda = nuevoEstado;

    const comandaActualizada = await this.comandaRepository.save(comanda);

    // Registrar auditoría
    await this.auditoriaService.registrar({
      tipoAccion: TipoAccion.COMANDA_MODIFICADA,
      modulo: ModuloSistema.COMANDA,
      entidadId: comandaActualizada.id,
      descripcion: `Estado de comanda cambiado a: ${nuevoEstado}`,
    });

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

    if (filtros.clienteId) {
      queryBuilder.andWhere('cliente.id = :clienteId', {
        clienteId: filtros.clienteId,
      });
    }

    if (filtros.creadoPorId) {
      queryBuilder.andWhere('creadoPor.id = :creadoPorId', {
        creadoPorId: filtros.creadoPorId,
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
}
