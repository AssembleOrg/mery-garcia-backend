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
import { TipoPago } from 'src/enums/TipoPago.enum';
import { fechaAR } from '../common/utils/fechas';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(PrepagoGuardado)
    private readonly prepagoGuardadoRepository: Repository<PrepagoGuardado>,
  ) {}

  async crear(crearClienteDto: CrearClienteDto): Promise<Cliente> {
    const { señaUsd, señaArs, tipoPagoARS, tipoPagoUSD, servicioReservado, serviciosReservados, ...rest } = crearClienteDto;
    // Lista de servicios de la seña: la nueva (array) o, por compat, el único.
    const listaServicios = (serviciosReservados && serviciosReservados.length
      ? serviciosReservados
      : servicioReservado ? [servicioReservado] : [])
      .map((x) => x.trim().slice(0, 200))
      .filter((x) => x.length > 0);
    const servicioPrincipal = listaServicios[0];
    const arrayServicios = listaServicios.length ? listaServicios : undefined;
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
          tipoPago: tipoPagoUSD ?? TipoPago.EFECTIVO,
          servicioReservado: servicioPrincipal,
          serviciosReservados: arrayServicios,
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
          tipoPago: tipoPagoARS ?? TipoPago.EFECTIVO,
          servicioReservado: servicioPrincipal,
          serviciosReservados: arrayServicios,
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

      const tipoPagoARS = cliente.tipoPagoARS;
      const tipoPagoUSD = cliente.tipoPagoUSD;

      return {
        ...cliente,
        señasDisponibles,
        tipoPagoARS,
        tipoPagoUSD,
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
        `(SELECT COUNT(*) FROM prepagos_guardados pg WHERE pg.cliente_id = cliente.id AND pg.estado = 'ACTIVO')`,
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

    const tipoPagoARS = cliente.tipoPagoARS;
    const tipoPagoUSD = cliente.tipoPagoUSD;

    return {
      ...cliente,
      señasDisponibles,
      tipoPagoARS,
      tipoPagoUSD,
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

    
    // Extraer señas del DTO
    const { señaUsd, señaArs, tipoPagoARS, tipoPagoUSD, servicioReservado, serviciosReservados, ...camposCliente } = actualizarClienteDto;
    const listaServiciosUpd = (serviciosReservados && serviciosReservados.length
      ? serviciosReservados
      : servicioReservado ? [servicioReservado] : [])
      .map((x) => x.trim().slice(0, 200))
      .filter((x) => x.length > 0);
    const servicioPrincipalUpd = listaServiciosUpd.length ? listaServiciosUpd[0] : undefined;
    const arrayServiciosUpd = listaServiciosUpd.length ? listaServiciosUpd : undefined;
    const tocaServicios = serviciosReservados !== undefined || servicioReservado !== undefined;
    
    // Actualizar campos del cliente
    Object.assign(cliente, camposCliente);
    const clienteActualizado = await this.clienteRepository.save(cliente);

    // El formulario edita el TOTAL de señas por moneda (la suma de las activas).
    // Antes ese total se escribía sobre una sola seña cualquiera, así que con dos
    // señas activas (30.000 + 40.000) cargar 40.000 dejaba 80.000 y además se
    // perdía el método de pago y el origen de la seña pisada.
    const servicios = {
      toca: tocaServicios,
      principal: servicioPrincipalUpd,
      lista: arrayServiciosUpd,
    };
    if (señaUsd !== undefined) {
      await this.ajustarTotalSeñas(clienteActualizado, TipoMoneda.USD, señaUsd, tipoPagoUSD, servicios);
    }
    if (señaArs !== undefined) {
      await this.ajustarTotalSeñas(clienteActualizado, TipoMoneda.ARS, señaArs, tipoPagoARS, servicios);
    }

    return await this.obtenerPorId(clienteActualizado.id);
  }

  /**
   * Lleva la suma de señas activas de una moneda al `nuevoTotal` pedido,
   * preservando el origen de cada seña:
   *  - Sin señas: crea una nueva si el total es mayor a 0.
   *  - Una sola seña: se ajusta su monto (y el método si es una carga manual).
   *  - Varias señas: si el total sube, se agrega una seña de ajuste por la
   *    diferencia; si baja, se descuenta de la más antigua a la más nueva y las
   *    que quedan en 0 se anulan. Si el total no cambia, no se toca ningún monto.
   */
  private async ajustarTotalSeñas(
    cliente: Cliente,
    moneda: TipoMoneda,
    nuevoTotalRaw: number,
    tipoPago: string | undefined,
    servicios: { toca: boolean; principal?: string; lista?: string[] },
  ): Promise<void> {
    const redondear = (n: number) => Math.round(Number(n) * 100) / 100;
    const nuevoTotal = Math.max(0, redondear(nuevoTotalRaw));
    const fecha = fechaAR();
    const nota = (previa: string | undefined, texto: string) =>
      [previa?.trim(), `${texto} (${fecha})`].filter(Boolean).join(' · ');
    const aplicarServicios = (seña: PrepagoGuardado) => {
      if (!servicios.toca) return;
      seña.servicioReservado = servicios.principal;
      seña.serviciosReservados = servicios.lista;
    };

    const activas = await this.prepagoGuardadoRepository.find({
      where: { cliente: { id: cliente.id }, moneda, estado: EstadoPrepago.ACTIVA },
      order: { fechaCreacion: 'ASC' },
    });
    const totalActual = redondear(activas.reduce((acc, s) => acc + Number(s.monto), 0));

    if (activas.length === 0) {
      if (nuevoTotal <= 0) return;
      const seña = new PrepagoGuardado();
      seña.monto = nuevoTotal;
      seña.moneda = moneda;
      seña.estado = EstadoPrepago.ACTIVA;
      seña.cliente = cliente;
      seña.observaciones = `Seña ${moneda} creada`;
      seña.tipoPago = (tipoPago as TipoPago) ?? TipoPago.EFECTIVO;
      aplicarServicios(seña);
      await this.prepagoGuardadoRepository.save(seña);
      return;
    }

    if (activas.length === 1) {
      const seña = activas[0];
      if (nuevoTotal <= 0) {
        seña.observaciones = nota(seña.observaciones, 'Anulada desde la ficha del cliente');
        await this.prepagoGuardadoRepository.save(seña);
        await this.prepagoGuardadoRepository.softRemove(seña);
        return;
      }
      if (redondear(seña.monto) !== nuevoTotal) {
        seña.observaciones = nota(seña.observaciones, `Monto ajustado de ${redondear(seña.monto)} a ${nuevoTotal}`);
        seña.monto = nuevoTotal;
      }
      // Las señas de reservas online conservan su método (Mercado Pago).
      if (tipoPago && !seña.bookingId) seña.tipoPago = tipoPago as TipoPago;
      aplicarServicios(seña);
      await this.prepagoGuardadoRepository.save(seña);
      return;
    }

    const masNueva = activas[activas.length - 1];
    const diferencia = redondear(nuevoTotal - totalActual);

    if (diferencia === 0) {
      if (servicios.toca) {
        aplicarServicios(masNueva);
        await this.prepagoGuardadoRepository.save(masNueva);
      }
      return;
    }

    if (diferencia > 0) {
      const ajuste = new PrepagoGuardado();
      ajuste.monto = diferencia;
      ajuste.moneda = moneda;
      ajuste.estado = EstadoPrepago.ACTIVA;
      ajuste.cliente = cliente;
      ajuste.observaciones = nota(undefined, `Ajuste manual: +${diferencia} (total ${nuevoTotal})`);
      ajuste.tipoPago = (tipoPago as TipoPago) ?? TipoPago.EFECTIVO;
      aplicarServicios(ajuste);
      await this.prepagoGuardadoRepository.save(ajuste);
      return;
    }

    // Baja el total: se descuenta primero de la seña más antigua.
    let restante = -diferencia;
    const sobrevivientes: PrepagoGuardado[] = [];
    for (const seña of activas) {
      const monto = redondear(seña.monto);
      if (restante <= 0) {
        sobrevivientes.push(seña);
        continue;
      }
      if (monto <= restante) {
        restante = redondear(restante - monto);
        seña.observaciones = nota(seña.observaciones, `Anulada por ajuste manual del total a ${nuevoTotal}`);
        await this.prepagoGuardadoRepository.save(seña);
        await this.prepagoGuardadoRepository.softRemove(seña);
      } else {
        seña.observaciones = nota(seña.observaciones, `Monto ajustado de ${monto} a ${redondear(monto - restante)}`);
        seña.monto = redondear(monto - restante);
        restante = 0;
        await this.prepagoGuardadoRepository.save(seña);
        sobrevivientes.push(seña);
      }
    }
    const destino = sobrevivientes[sobrevivientes.length - 1];
    if (destino && servicios.toca) {
      aplicarServicios(destino);
      await this.prepagoGuardadoRepository.save(destino);
    }
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
      .where('prepagosGuardados.estado = :estado', { estado: EstadoPrepago.ACTIVA })
      .getCount();

    return {
      totalClientes,
      clientesActivos,
      clientesEliminados,
      clientesConSeñas,
    };
  }

  async obtenerTotalSeniasActivas(): Promise<{ ars: number; usd: number }> {
    const rows = await this.prepagoGuardadoRepository
      .createQueryBuilder('pg')
      .select('pg.moneda', 'moneda')
      .addSelect('COALESCE(SUM(pg.monto), 0)', 'total')
      .addSelect('COALESCE(SUM(pg.montoTraspasado), 0)', 'montoTraspasado')
      .where('pg.estado = :estado', { estado: EstadoPrepago.ACTIVA })
      .groupBy('pg.moneda')
      .getRawMany<{ moneda: TipoMoneda; total: string; montoTraspasado: string }>();
      console.log(rows, "hola");

    let ars = 0;
    let usd = 0;

    for (const r of rows) {
      if (r.moneda === TipoMoneda.ARS) ars = Number(r.total ?? 0) - Number(r.montoTraspasado ?? 0);
      if (r.moneda === TipoMoneda.USD) usd = Number(r.total ?? 0) - Number(r.montoTraspasado ?? 0);
    }

    return { ars, usd };
  }
}
