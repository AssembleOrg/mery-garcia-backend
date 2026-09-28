import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TipoMoneda } from '../enums/TipoMoneda.enum';
import { Acreedor, TipoAcreedor } from './entities/acreedor.entity';
import { Deuda } from './entities/deuda.entity';
import { PagoDeuda } from './entities/pagoDeuda.entity';
import { ComprobantePago } from './entities/comprobantePago.entity';
import {
  MovimientoContable,
  TipoMovimientoContable as T,
} from './entities/movimientoContable.entity';
import {
  ActualizarAcreedorDto,
  ActualizarDeudaDto,
  ActualizarPagoDto,
  CrearAcreedorDto,
  CrearDeudaDto,
  CrearPagoDto,
  FiltroDeudasDto,
  FiltroHistorialDto,
} from './dto/contable.dto';

export interface UsuarioContable {
  id: string;
  nombre: string;
}

/**
 * Ventana en la que un pago (o una deuda recién cargada) se puede corregir.
 * Fuera de ella se responde 409, no 403: el front cierra la sesión ante un 403.
 */
const VENTANA_EDICION_MS = 24 * 60 * 60 * 1000;
const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024;
const MAX_COMPROBANTES_POR_PAGO = 10;
const MIME_COMPROBANTE =
  /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;
const MONEDAS = [TipoMoneda.ARS, TipoMoneda.USD] as const;
const TZ_AR = 'America/Argentina/Buenos_Aires';

type EstadoDeuda = 'PENDIENTE' | 'PARCIAL' | 'SALDADA';

export interface Totales {
  deuda: number;
  pagado: number;
  saldo: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const totalesVacios = (): Totales => ({ deuda: 0, pagado: 0, saldo: 0 });

/** Hoy en Argentina, "AAAA-MM-DD". */
function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR }).format(
    new Date(),
  );
}

function editableHasta(createdAt: Date): Date {
  return new Date(new Date(createdAt).getTime() + VENTANA_EDICION_MS);
}

function dentroDeVentana(createdAt: Date): boolean {
  return Date.now() < editableHasta(createdAt).getTime();
}

/** "$ 150.000" / "US$ 1.250,50", para las descripciones del historial. */
function fmtMonto(n: number, moneda: string): string {
  const cuerpo = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${moneda === 'USD' ? 'US$' : '$'} ${cuerpo}`;
}

function limpiar(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Nombre del archivo como lo mandó el navegador (multer lo decodifica en latin1). */
function nombreArchivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  return (utf8.includes('�') ? original : utf8).slice(0, 255);
}

@Injectable()
export class ContableService {
  private readonly logger = new Logger(ContableService.name);

  constructor(
    @InjectRepository(Acreedor)
    private readonly acreedores: Repository<Acreedor>,
    @InjectRepository(Deuda) private readonly deudas: Repository<Deuda>,
    @InjectRepository(PagoDeuda) private readonly pagos: Repository<PagoDeuda>,
    @InjectRepository(ComprobantePago)
    private readonly comprobantes: Repository<ComprobantePago>,
    @InjectRepository(MovimientoContable)
    private readonly historial: Repository<MovimientoContable>,
    private readonly dataSource: DataSource,
  ) {}

  // ───────────────────────────── Lectura / cálculo ─────────────────────────────

  /** Deudas vivas con sus pagos vivos (y, si se pide, metadatos de comprobantes). */
  private async cargarDeudas(
    opciones: {
      acreedorId?: string;
      conComprobantes?: boolean;
      deudaId?: string;
    } = {},
  ): Promise<Deuda[]> {
    const qb = this.deudas
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.acreedor', 'a')
      .leftJoinAndSelect('d.pagos', 'p', 'p.deletedAt IS NULL');
    if (opciones.conComprobantes) qb.leftJoinAndSelect('p.comprobantes', 'c');
    if (opciones.acreedorId)
      qb.andWhere('d.acreedorId = :acreedorId', {
        acreedorId: opciones.acreedorId,
      });
    if (opciones.deudaId)
      qb.andWhere('d.id = :deudaId', { deudaId: opciones.deudaId });
    return qb
      .orderBy('d.fecha', 'DESC')
      .addOrderBy('d.createdAt', 'DESC')
      .addOrderBy('p.fecha', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();
  }

  private calcular(d: Deuda, hoy = hoyAR()) {
    const pagado = r2((d.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0));
    const saldo = r2(Number(d.monto) - pagado);
    const estado: EstadoDeuda =
      saldo <= 0 ? 'SALDADA' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
    const vencida = saldo > 0 && !!d.vencimiento && d.vencimiento < hoy;
    return { pagado, saldo, estado, vencida };
  }

  /** Deuda lista para la API: saldo, estado y hasta cuándo se puede corregir. */
  private serializarDeuda(d: Deuda, hoy = hoyAR()) {
    const calc = this.calcular(d, hoy);
    return {
      id: d.id,
      acreedorId: d.acreedorId,
      acreedor: d.acreedor
        ? {
            id: d.acreedor.id,
            nombre: d.acreedor.nombre,
            tipo: d.acreedor.tipo,
          }
        : undefined,
      concepto: d.concepto,
      moneda: d.moneda,
      monto: Number(d.monto),
      fecha: d.fecha,
      vencimiento: d.vencimiento,
      notas: d.notas,
      creadoPorNombre: d.creadoPorNombre,
      createdAt: d.createdAt,
      editableHasta: editableHasta(d.createdAt),
      editable: dentroDeVentana(d.createdAt),
      ...calc,
      pagos: (d.pagos ?? []).map((p) => this.serializarPago(p)),
    };
  }

  private serializarPago(p: PagoDeuda) {
    return {
      id: p.id,
      deudaId: p.deudaId,
      monto: Number(p.monto),
      fecha: p.fecha,
      metodo: p.metodo,
      nota: p.nota,
      creadoPorNombre: p.creadoPorNombre,
      createdAt: p.createdAt,
      editableHasta: editableHasta(p.createdAt),
      editable: dentroDeVentana(p.createdAt),
      comprobantes: (p.comprobantes ?? []).map((c) =>
        this.serializarComprobante(c),
      ),
    };
  }

  private serializarComprobante(c: ComprobantePago) {
    return {
      id: c.id,
      pagoId: c.pagoId,
      nombre: c.nombre,
      mimeType: c.mimeType,
      tamanio: c.tamanio,
      createdAt: c.createdAt,
      editable: dentroDeVentana(c.createdAt),
    };
  }

  private totalesPorMoneda(deudas: Deuda[]): Record<TipoMoneda, Totales> {
    const t = { ARS: totalesVacios(), USD: totalesVacios() } as Record<
      TipoMoneda,
      Totales
    >;
    for (const d of deudas) {
      const { pagado, saldo } = this.calcular(d);
      const m = t[d.moneda] ?? (t[d.moneda] = totalesVacios());
      m.deuda = r2(m.deuda + Number(d.monto));
      m.pagado = r2(m.pagado + pagado);
      m.saldo = r2(m.saldo + saldo);
    }
    return t;
  }

  // ───────────────────────────────── Resumen ───────────────────────────────────

  /** KPIs, serie mensual y rankings para el tablero. */
  async resumen(meses = 12) {
    const hoy = hoyAR();
    const deudas = await this.cargarDeudas();
    const mesActual = hoy.slice(0, 7);
    const mesAnterior = this.sumarMeses(mesActual, -1);

    const kpis = Object.fromEntries(
      MONEDAS.map((m) => [
        m,
        {
          deudaTotal: 0,
          pagadoTotal: 0,
          saldo: 0,
          saldoVencido: 0,
          deudasAbiertas: 0,
          deudasVencidas: 0,
          acreedoresConSaldo: 0,
          nuevaDeudaMes: 0,
          pagadoMes: 0,
          pagadoMesAnterior: 0,
          porcentajeCancelado: 0,
        },
      ]),
    ) as unknown as Record<TipoMoneda, Record<string, number>>;

    const mesesSerie = Array.from({ length: meses }, (_, i) =>
      this.sumarMeses(mesActual, i - meses + 1),
    );
    const primerMes = mesesSerie[0];
    const serie = mesesSerie.map((mes) => ({
      mes,
      ARS: { deuda: 0, pagos: 0, saldo: 0 },
      USD: { deuda: 0, pagos: 0, saldo: 0 },
    }));
    const idxMes = new Map(mesesSerie.map((m, i) => [m, i]));
    // Saldo arrastrado de antes del primer mes de la serie.
    const arrastre = { ARS: 0, USD: 0 } as Record<TipoMoneda, number>;

    const porAcreedor = new Map<
      string,
      { id: string; nombre: string; tipo: string; ARS: number; USD: number }
    >();

    for (const d of deudas) {
      const m = d.moneda;
      const k = kpis[m];
      if (!k) continue;
      const c = this.calcular(d, hoy);
      k.deudaTotal += Number(d.monto);
      k.pagadoTotal += c.pagado;
      k.saldo += c.saldo;
      if (c.saldo > 0) k.deudasAbiertas++;
      if (c.vencida) {
        k.deudasVencidas++;
        k.saldoVencido += c.saldo;
      }
      if (d.fecha.slice(0, 7) === mesActual) k.nuevaDeudaMes += Number(d.monto);

      const mesDeuda = d.fecha.slice(0, 7);
      if (mesDeuda < primerMes) arrastre[m] += Number(d.monto);
      else if (idxMes.has(mesDeuda))
        serie[idxMes.get(mesDeuda)!][m].deuda += Number(d.monto);

      for (const p of d.pagos ?? []) {
        const mesPago = p.fecha.slice(0, 7);
        if (mesPago === mesActual) k.pagadoMes += Number(p.monto);
        if (mesPago === mesAnterior) k.pagadoMesAnterior += Number(p.monto);
        if (mesPago < primerMes) arrastre[m] -= Number(p.monto);
        else if (idxMes.has(mesPago))
          serie[idxMes.get(mesPago)!][m].pagos += Number(p.monto);
      }

      if (c.saldo > 0 && d.acreedor) {
        const a = porAcreedor.get(d.acreedorId) ?? {
          id: d.acreedorId,
          nombre: d.acreedor.nombre,
          tipo: d.acreedor.tipo,
          ARS: 0,
          USD: 0,
        };
        a[m] = r2(a[m] + c.saldo);
        porAcreedor.set(d.acreedorId, a);
      }
    }

    for (const m of MONEDAS) {
      const k = kpis[m];
      for (const key of Object.keys(k)) k[key] = r2(k[key]);
      k.acreedoresConSaldo = [...porAcreedor.values()].filter(
        (a) => a[m] > 0,
      ).length;
      k.porcentajeCancelado =
        k.deudaTotal > 0 ? r2((k.pagadoTotal / k.deudaTotal) * 100) : 0;
      let saldo = arrastre[m];
      for (const punto of serie) {
        punto[m].deuda = r2(punto[m].deuda);
        punto[m].pagos = r2(punto[m].pagos);
        saldo += punto[m].deuda - punto[m].pagos;
        punto[m].saldo = r2(saldo);
      }
    }

    const proximosVencimientos = deudas
      .map((d) => this.serializarDeuda(d, hoy))
      .filter((d) => d.saldo > 0 && d.vencimiento)
      .sort((a, b) => a.vencimiento!.localeCompare(b.vencimiento!))
      .slice(0, 8)
      .map((d) => ({ ...d, pagos: undefined }));

    const actividad = await this.historial.find({
      order: { createdAt: 'DESC' },
      take: 8,
    });

    return {
      hoy,
      kpis,
      serie,
      acreedores: [...porAcreedor.values()],
      proximosVencimientos,
      actividad,
    };
  }

  private sumarMeses(mes: string, n: number): string {
    const [y, m] = mes.split('-').map(Number);
    const total = y * 12 + (m - 1) + n;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  }

  // ──────────────────────────────── Acreedores ─────────────────────────────────

  async listarAcreedores(buscar?: string) {
    const lista = await this.acreedores.find({ order: { nombre: 'ASC' } });
    const deudas = await this.cargarDeudas();
    const hoy = hoyAR();
    const porAcreedor = new Map<string, Deuda[]>();
    for (const d of deudas) {
      const arr = porAcreedor.get(d.acreedorId) ?? [];
      arr.push(d);
      porAcreedor.set(d.acreedorId, arr);
    }

    const q = buscar?.trim().toLowerCase();
    return lista
      .filter(
        (a) =>
          !q ||
          a.nombre.toLowerCase().includes(q) ||
          (a.documento ?? '').toLowerCase().includes(q),
      )
      .map((a) => {
        const propias = porAcreedor.get(a.id) ?? [];
        const calcs = propias.map((d) => this.calcular(d, hoy));
        const fechas = propias.flatMap((d) => [
          new Date(d.createdAt).getTime(),
          ...(d.pagos ?? []).map((p) => new Date(p.createdAt).getTime()),
        ]);
        return {
          ...a,
          totales: this.totalesPorMoneda(propias),
          cantidadDeudas: propias.length,
          deudasAbiertas: calcs.filter((c) => c.saldo > 0).length,
          deudasVencidas: calcs.filter((c) => c.vencida).length,
          ultimoMovimiento: fechas.length
            ? new Date(Math.max(...fechas))
            : a.createdAt,
        };
      });
  }

  async obtenerAcreedor(id: string) {
    const acreedor = await this.acreedores.findOne({ where: { id } });
    if (!acreedor) throw new NotFoundException('Acreedor no encontrado');
    const deudas = await this.cargarDeudas({
      acreedorId: id,
      conComprobantes: true,
    });
    const hoy = hoyAR();
    return {
      ...acreedor,
      totales: this.totalesPorMoneda(deudas),
      deudas: deudas.map((d) => this.serializarDeuda(d, hoy)),
    };
  }

  async crearAcreedor(dto: CrearAcreedorDto, u: UsuarioContable) {
    const nombre = dto.nombre.trim();
    await this.verificarNombreAcreedorLibre(nombre);
    const acreedor = await this.dataSource.transaction(async (m) => {
      const creado = await m.save(
        m.create(Acreedor, {
          nombre,
          tipo: dto.tipo,
          documento: limpiar(dto.documento),
          telefono: limpiar(dto.telefono),
          email: limpiar(dto.email),
          notas: limpiar(dto.notas),
        }),
      );
      await this.registrar(m, u, {
        tipo: T.ACREEDOR_CREADO,
        acreedorId: creado.id,
        descripcion: `Alta de ${creado.tipo === TipoAcreedor.EMPRESA ? 'empresa' : 'persona'} "${creado.nombre}"`,
      });
      return creado;
    });
    this.logger.log(`Acreedor creado: ${acreedor.nombre} por ${u.nombre}`);
    return acreedor;
  }

  async actualizarAcreedor(
    id: string,
    dto: ActualizarAcreedorDto,
    u: UsuarioContable,
  ) {
    const acreedor = await this.acreedores.findOne({ where: { id } });
    if (!acreedor) throw new NotFoundException('Acreedor no encontrado');
    const antes = { ...acreedor };

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (nombre.toLowerCase() !== acreedor.nombre.toLowerCase()) {
        await this.verificarNombreAcreedorLibre(nombre, id);
      }
      acreedor.nombre = nombre;
    }
    if (dto.tipo !== undefined) acreedor.tipo = dto.tipo;
    if (dto.documento !== undefined)
      acreedor.documento = limpiar(dto.documento);
    if (dto.telefono !== undefined) acreedor.telefono = limpiar(dto.telefono);
    if (dto.email !== undefined) acreedor.email = limpiar(dto.email);
    if (dto.notas !== undefined) acreedor.notas = limpiar(dto.notas);

    const cambios = this.diferencias(antes, acreedor, [
      'nombre',
      'tipo',
      'documento',
      'telefono',
      'email',
      'notas',
    ]);
    if (!cambios) return acreedor;

    return this.dataSource.transaction(async (m) => {
      const guardado = await m.save(acreedor);
      await this.registrar(m, u, {
        tipo: T.ACREEDOR_EDITADO,
        acreedorId: id,
        descripcion: `Datos de "${guardado.nombre}" editados`,
        detalle: cambios,
      });
      return guardado;
    });
  }

  async eliminarAcreedor(id: string, u: UsuarioContable) {
    const acreedor = await this.acreedores.findOne({ where: { id } });
    if (!acreedor) throw new NotFoundException('Acreedor no encontrado');
    const cantidad = await this.deudas.count({ where: { acreedorId: id } });
    if (cantidad > 0) {
      throw new ConflictException(
        `"${acreedor.nombre}" tiene ${cantidad} deuda(s) registradas; no se puede borrar para no perder el historial.`,
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.softDelete(Acreedor, id);
      await this.registrar(m, u, {
        tipo: T.ACREEDOR_ELIMINADO,
        acreedorId: id,
        descripcion: `Baja de "${acreedor.nombre}"`,
      });
    });
  }

  private async verificarNombreAcreedorLibre(
    nombre: string,
    exceptoId?: string,
  ) {
    const qb = this.acreedores
      .createQueryBuilder('a')
      .where('LOWER(a.nombre) = LOWER(:nombre)', { nombre });
    if (exceptoId) qb.andWhere('a.id <> :exceptoId', { exceptoId });
    if (await qb.getExists())
      throw new ConflictException(`Ya existe un acreedor llamado "${nombre}"`);
  }

  // ────────────────────────────────── Deudas ───────────────────────────────────

  async listarDeudas(filtro: FiltroDeudasDto) {
    const hoy = hoyAR();
    let lista = (
      await this.cargarDeudas({
        acreedorId: filtro.acreedorId,
        conComprobantes: true,
      })
    ).map((d) => this.serializarDeuda(d, hoy));
    if (filtro.moneda) lista = lista.filter((d) => d.moneda === filtro.moneda);
    switch (filtro.estado ?? 'todas') {
      case 'abiertas':
        lista = lista.filter((d) => d.saldo > 0);
        break;
      case 'saldadas':
        lista = lista.filter((d) => d.saldo <= 0);
        break;
      case 'vencidas':
        lista = lista.filter((d) => d.vencida);
        break;
    }
    return lista;
  }

  async obtenerDeuda(id: string) {
    const [deuda] = await this.cargarDeudas({
      deudaId: id,
      conComprobantes: true,
    });
    if (!deuda) throw new NotFoundException('Deuda no encontrada');
    return this.serializarDeuda(deuda);
  }

  async crearDeuda(dto: CrearDeudaDto, u: UsuarioContable) {
    const acreedor = await this.acreedores.findOne({
      where: { id: dto.acreedorId },
    });
    if (!acreedor) throw new NotFoundException('Acreedor no encontrado');
    const fecha = dto.fecha ?? hoyAR();
    this.validarVencimiento(fecha, dto.vencimiento);

    const id = await this.dataSource.transaction(async (m) => {
      const creada = await m.save(
        m.create(Deuda, {
          acreedorId: acreedor.id,
          concepto: dto.concepto.trim(),
          moneda: dto.moneda,
          monto: r2(dto.monto),
          fecha,
          vencimiento: dto.vencimiento ?? null,
          notas: limpiar(dto.notas),
          creadoPorId: u.id,
          creadoPorNombre: u.nombre,
        }),
      );
      await this.registrar(m, u, {
        tipo: T.DEUDA_CREADA,
        acreedorId: acreedor.id,
        deudaId: creada.id,
        moneda: creada.moneda,
        monto: creada.monto,
        descripcion: `Nueva deuda con "${acreedor.nombre}": ${creada.concepto}`,
      });
      return creada.id;
    });
    return this.obtenerDeuda(id);
  }

  /**
   * Concepto, vencimiento y notas se pueden corregir siempre. Lo que cambia
   * el saldo (monto, moneda, acreedor, fecha) sólo en las primeras 24 h.
   */
  async actualizarDeuda(
    id: string,
    dto: ActualizarDeudaDto,
    u: UsuarioContable,
  ) {
    const [deuda] = await this.cargarDeudas({ deudaId: id });
    if (!deuda) throw new NotFoundException('Deuda no encontrada');
    const antes = { ...deuda, acreedor: undefined, pagos: undefined };
    const { pagado } = this.calcular(deuda);

    const tocaSensibles =
      (dto.monto !== undefined && r2(dto.monto) !== Number(deuda.monto)) ||
      (dto.moneda !== undefined && dto.moneda !== deuda.moneda) ||
      (dto.acreedorId !== undefined && dto.acreedorId !== deuda.acreedorId) ||
      (dto.fecha !== undefined && dto.fecha !== deuda.fecha);
    if (tocaSensibles && !dentroDeVentana(deuda.createdAt)) {
      throw new ConflictException(
        'Pasaron más de 24 h desde que se cargó la deuda: sólo se pueden cambiar concepto, vencimiento y notas.',
      );
    }

    if (dto.acreedorId !== undefined && dto.acreedorId !== deuda.acreedorId) {
      const nuevo = await this.acreedores.findOne({
        where: { id: dto.acreedorId },
      });
      if (!nuevo) throw new NotFoundException('Acreedor no encontrado');
      deuda.acreedorId = nuevo.id;
    }
    if (dto.moneda !== undefined && dto.moneda !== deuda.moneda) {
      if (pagado > 0)
        throw new BadRequestException(
          'La deuda ya tiene pagos: no se puede cambiar la moneda.',
        );
      deuda.moneda = dto.moneda;
    }
    if (dto.monto !== undefined) {
      if (r2(dto.monto) < pagado) {
        throw new BadRequestException(
          `El monto no puede ser menor a lo ya pagado (${fmtMonto(pagado, deuda.moneda)}).`,
        );
      }
      deuda.monto = r2(dto.monto);
    }
    if (dto.fecha !== undefined) deuda.fecha = dto.fecha;
    if (dto.concepto !== undefined) deuda.concepto = dto.concepto.trim();
    if (dto.vencimiento !== undefined)
      deuda.vencimiento = dto.vencimiento ?? null;
    if (dto.notas !== undefined) deuda.notas = limpiar(dto.notas);
    this.validarVencimiento(deuda.fecha, deuda.vencimiento);

    const cambios = this.diferencias(antes, deuda, [
      'acreedorId',
      'concepto',
      'moneda',
      'monto',
      'fecha',
      'vencimiento',
      'notas',
    ]);
    if (!cambios) return this.obtenerDeuda(id);

    await this.dataSource.transaction(async (m) => {
      await m.update(Deuda, id, {
        acreedorId: deuda.acreedorId,
        concepto: deuda.concepto,
        moneda: deuda.moneda,
        monto: deuda.monto,
        fecha: deuda.fecha,
        vencimiento: deuda.vencimiento,
        notas: deuda.notas,
      });
      await this.registrar(m, u, {
        tipo: T.DEUDA_EDITADA,
        acreedorId: deuda.acreedorId,
        deudaId: id,
        moneda: deuda.moneda,
        monto: deuda.monto,
        descripcion: `Deuda "${deuda.concepto}" editada`,
        detalle: cambios,
      });
    });
    return this.obtenerDeuda(id);
  }

  /** Sólo una deuda recién cargada (24 h) y sin pagos: si no, es historia. */
  async eliminarDeuda(id: string, u: UsuarioContable) {
    const [deuda] = await this.cargarDeudas({ deudaId: id });
    if (!deuda) throw new NotFoundException('Deuda no encontrada');
    if (!dentroDeVentana(deuda.createdAt)) {
      throw new ConflictException(
        'Sólo se puede borrar una deuda en las primeras 24 h desde que se cargó.',
      );
    }
    if ((deuda.pagos ?? []).length > 0) {
      throw new ConflictException(
        'La deuda tiene pagos: borrá primero los pagos.',
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.softDelete(Deuda, id);
      await this.registrar(m, u, {
        tipo: T.DEUDA_ELIMINADA,
        acreedorId: deuda.acreedorId,
        deudaId: id,
        moneda: deuda.moneda,
        monto: deuda.monto,
        descripcion: `Deuda "${deuda.concepto}" borrada`,
        detalle: {
          concepto: deuda.concepto,
          monto: deuda.monto,
          moneda: deuda.moneda,
          fecha: deuda.fecha,
        },
      });
    });
  }

  private validarVencimiento(fecha: string, vencimiento?: string | null) {
    if (vencimiento && vencimiento < fecha) {
      throw new BadRequestException(
        'El vencimiento no puede ser anterior a la fecha de la deuda.',
      );
    }
  }

  // ─────────────────────────────────── Pagos ───────────────────────────────────

  /**
   * Saldo de la deuda bloqueando su fila: dos pagos simultáneos no pueden
   * dejarla en negativo.
   */
  private async saldoBloqueado(
    m: EntityManager,
    deudaId: string,
    exceptoPagoId?: string,
  ) {
    const deuda = await m
      .createQueryBuilder(Deuda, 'd')
      .setLock('pessimistic_write')
      .where('d.id = :deudaId', { deudaId })
      .getOne();
    if (!deuda) throw new NotFoundException('Deuda no encontrada');
    const qb = m
      .createQueryBuilder(PagoDeuda, 'p')
      .select('COALESCE(SUM(p.monto), 0)', 'total')
      .where('p.deudaId = :deudaId', { deudaId })
      .andWhere('p.deletedAt IS NULL');
    if (exceptoPagoId) qb.andWhere('p.id <> :exceptoPagoId', { exceptoPagoId });
    const { total } = (await qb.getRawOne<{ total: string }>())!;
    return { deuda, saldo: r2(Number(deuda.monto) - Number(total)) };
  }

  async registrarPago(deudaId: string, dto: CrearPagoDto, u: UsuarioContable) {
    const pagoId = await this.dataSource.transaction(async (m) => {
      const { deuda, saldo } = await this.saldoBloqueado(m, deudaId);
      const monto = r2(dto.monto);
      if (saldo <= 0)
        throw new BadRequestException('La deuda ya está saldada.');
      if (monto > saldo) {
        throw new BadRequestException(
          `El pago supera el saldo pendiente (${fmtMonto(saldo, deuda.moneda)}).`,
        );
      }
      const pago = await m.save(
        m.create(PagoDeuda, {
          deudaId,
          monto,
          fecha: dto.fecha ?? hoyAR(),
          metodo: limpiar(dto.metodo),
          nota: limpiar(dto.nota),
          creadoPorId: u.id,
          creadoPorNombre: u.nombre,
        }),
      );
      const restante = r2(saldo - monto);
      await this.registrar(m, u, {
        tipo: T.PAGO_REGISTRADO,
        acreedorId: deuda.acreedorId,
        deudaId,
        pagoId: pago.id,
        moneda: deuda.moneda,
        monto,
        descripcion:
          restante <= 0
            ? `Pago que salda "${deuda.concepto}"`
            : `Pago parcial de "${deuda.concepto}" (quedan ${fmtMonto(restante, deuda.moneda)})`,
      });
      return pago.id;
    });
    return this.obtenerPago(pagoId);
  }

  private async obtenerPago(id: string) {
    const pago = await this.pagos.findOne({
      where: { id },
      relations: { comprobantes: true },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    return this.serializarPago(pago);
  }

  private async pagoEditable(id: string) {
    const pago = await this.pagos.findOne({
      where: { id },
      relations: { deuda: true },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (!dentroDeVentana(pago.createdAt)) {
      throw new ConflictException(
        'Pasaron más de 24 h desde que se registró el pago: ya no se puede modificar.',
      );
    }
    return pago;
  }

  async actualizarPago(id: string, dto: ActualizarPagoDto, u: UsuarioContable) {
    const pago = await this.pagoEditable(id);
    const antes = { ...pago, deuda: undefined };

    await this.dataSource.transaction(async (m) => {
      const { deuda, saldo } = await this.saldoBloqueado(m, pago.deudaId, id);
      if (dto.monto !== undefined) {
        const monto = r2(dto.monto);
        if (monto > saldo) {
          throw new BadRequestException(
            `El pago supera el saldo pendiente (${fmtMonto(saldo, deuda.moneda)}).`,
          );
        }
        pago.monto = monto;
      }
      if (dto.fecha !== undefined) pago.fecha = dto.fecha;
      if (dto.metodo !== undefined) pago.metodo = limpiar(dto.metodo);
      if (dto.nota !== undefined) pago.nota = limpiar(dto.nota);

      const cambios = this.diferencias(antes, pago, [
        'monto',
        'fecha',
        'metodo',
        'nota',
      ]);
      if (!cambios) return;
      await m.update(PagoDeuda, id, {
        monto: pago.monto,
        fecha: pago.fecha,
        metodo: pago.metodo,
        nota: pago.nota,
      });
      await this.registrar(m, u, {
        tipo: T.PAGO_EDITADO,
        acreedorId: deuda.acreedorId,
        deudaId: deuda.id,
        pagoId: id,
        moneda: deuda.moneda,
        monto: pago.monto,
        descripcion: `Pago de "${deuda.concepto}" editado`,
        detalle: cambios,
      });
    });
    return this.obtenerPago(id);
  }

  async eliminarPago(id: string, u: UsuarioContable) {
    const pago = await this.pagoEditable(id);
    await this.dataSource.transaction(async (m) => {
      await m.softDelete(PagoDeuda, id);
      await this.registrar(m, u, {
        tipo: T.PAGO_ELIMINADO,
        acreedorId: pago.deuda.acreedorId,
        deudaId: pago.deudaId,
        pagoId: id,
        moneda: pago.deuda.moneda,
        monto: pago.monto,
        descripcion: `Pago de "${pago.deuda.concepto}" borrado (vuelve al saldo)`,
        detalle: {
          monto: pago.monto,
          fecha: pago.fecha,
          metodo: pago.metodo,
          nota: pago.nota,
        },
      });
    });
  }

  // ──────────────────────────────── Comprobantes ───────────────────────────────

  /** Se pueden sumar comprobantes a un pago en cualquier momento (la factura llega después). */
  async agregarComprobantes(
    pagoId: string,
    archivos: Express.Multer.File[],
    u: UsuarioContable,
  ) {
    if (!archivos?.length) throw new BadRequestException('Falta el archivo.');
    const pago = await this.pagos.findOne({
      where: { id: pagoId },
      relations: { deuda: true },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');

    for (const a of archivos) {
      if (!MIME_COMPROBANTE.test(a.mimetype)) {
        throw new BadRequestException(
          `"${nombreArchivo(a.originalname)}": sólo imágenes o PDF.`,
        );
      }
      if (a.size > MAX_COMPROBANTE_BYTES) {
        throw new BadRequestException(
          `"${nombreArchivo(a.originalname)}" pesa más de 10 MB.`,
        );
      }
    }
    const existentes = await this.comprobantes.count({ where: { pagoId } });
    if (existentes + archivos.length > MAX_COMPROBANTES_POR_PAGO) {
      throw new BadRequestException(
        `Máximo ${MAX_COMPROBANTES_POR_PAGO} comprobantes por pago.`,
      );
    }

    await this.dataSource.transaction(async (m) => {
      for (const a of archivos) {
        const c = await m.save(
          m.create(ComprobantePago, {
            pagoId,
            nombre: nombreArchivo(a.originalname),
            mimeType: a.mimetype,
            tamanio: a.size,
            datos: a.buffer,
          }),
        );
        await this.registrar(m, u, {
          tipo: T.COMPROBANTE_AGREGADO,
          acreedorId: pago.deuda.acreedorId,
          deudaId: pago.deudaId,
          pagoId,
          descripcion: `Comprobante "${c.nombre}" adjuntado al pago de "${pago.deuda.concepto}"`,
        });
      }
    });
    return this.obtenerPago(pagoId);
  }

  async comprobante(id: string) {
    const c = await this.comprobantes
      .createQueryBuilder('c')
      .addSelect('c.datos')
      .where('c.id = :id', { id })
      .getOne();
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    return c;
  }

  async eliminarComprobante(id: string, u: UsuarioContable) {
    const c = await this.comprobantes.findOne({
      where: { id },
      relations: { pago: { deuda: true } },
    });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    if (!dentroDeVentana(c.createdAt)) {
      throw new ConflictException(
        'Sólo se puede quitar un comprobante en las primeras 24 h.',
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.delete(ComprobantePago, id);
      await this.registrar(m, u, {
        tipo: T.COMPROBANTE_ELIMINADO,
        acreedorId: c.pago?.deuda?.acreedorId ?? null,
        deudaId: c.pago?.deudaId ?? null,
        pagoId: c.pagoId,
        descripcion: `Comprobante "${c.nombre}" quitado`,
      });
    });
  }

  // ───────────────────────────────── Historial ─────────────────────────────────

  async listarHistorial(filtro: FiltroHistorialDto) {
    const qb = this.historial
      .createQueryBuilder('h')
      .orderBy('h.createdAt', 'DESC')
      .take(filtro.limite ?? 100);
    if (filtro.acreedorId)
      qb.andWhere('h.acreedorId = :acreedorId', {
        acreedorId: filtro.acreedorId,
      });
    if (filtro.deudaId)
      qb.andWhere('h.deudaId = :deudaId', { deudaId: filtro.deudaId });
    return qb.getMany();
  }

  private async registrar(
    m: EntityManager,
    u: UsuarioContable,
    datos: {
      tipo: T;
      descripcion: string;
      acreedorId?: string | null;
      deudaId?: string | null;
      pagoId?: string | null;
      moneda?: string | null;
      monto?: number | null;
      detalle?: Record<string, unknown> | null;
    },
  ) {
    await m.insert(MovimientoContable, {
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      acreedorId: datos.acreedorId ?? null,
      deudaId: datos.deudaId ?? null,
      pagoId: datos.pagoId ?? null,
      moneda: datos.moneda ?? null,
      monto: datos.monto ?? null,
      detalle: (datos.detalle ?? null) as MovimientoContable['detalle'] &
        object,
      usuarioId: u.id,
      usuarioNombre: u.nombre,
    });
  }

  /** { campo: { antes, despues } } de lo que cambió, o null si nada. */
  private diferencias(antes: object, despues: object, campos: string[]) {
    const out: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const c of campos) {
      const a = (antes as Record<string, unknown>)[c] ?? null;
      const d = (despues as Record<string, unknown>)[c] ?? null;
      if (String(a) !== String(d)) out[c] = { antes: a, despues: d };
    }
    return Object.keys(out).length ? out : null;
  }
}
