import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EstadoLote, LoteValidacion } from './entities/loteValidacion.entity';
import {
  EstadoPagina,
  PaginaValidacion,
  ResultadoPagina,
} from './entities/paginaValidacion.entity';
import {
  LectorComandasService,
  type LecturaComanda,
} from './lector-ia.service';
import { comparar, numeroSistema, type ComandaSistema } from './comparador';
import {
  imagenesDePdf,
  imagenSuelta,
  validarTamano,
  type ImagenPagina,
} from './pdf-paginas';

export interface UsuarioValidacion {
  id: string;
  nombre: string;
}

const MAX_PAGINAS = 80;
/** Hojas leídas en paralelo (la API tolera más, pero así no se satura el límite por minuto). */
const CONCURRENCIA = 2;

const COLUMNAS_PAGINA = [
  'p.id',
  'p.loteId',
  'p.orden',
  'p.mimeType',
  'p.estado',
  'p.lectura',
  'p.numeroComanda',
  'p.comandaId',
  'p.resultado',
  'p.diferencias',
  'p.sistema',
  'p.tokensEntrada',
  'p.tokensSalida',
  'p.costoUsd',
  'p.error',
  'p.leidaAt',
  'p.createdAt',
];

function nombreArchivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  return (utf8.includes('�') ? original : utf8).slice(0, 255);
}

/**
 * Validación de comandas en papel con IA. Todo es a pedido:
 * - subir un lote NO lee nada;
 * - "leer" manda cada hoja a la IA (se cobra) y compara contra el sistema;
 * - nunca cambia una comanda: sólo informa coincidencias y diferencias.
 */
@Injectable()
export class ValidacionComandasService {
  private readonly logger = new Logger(ValidacionComandasService.name);
  /** Lotes que se están leyendo en este proceso (evita dos lecturas a la vez). */
  private readonly enCurso = new Set<string>();

  constructor(
    @InjectRepository(LoteValidacion)
    private readonly lotes: Repository<LoteValidacion>,
    @InjectRepository(PaginaValidacion)
    private readonly paginas: Repository<PaginaValidacion>,
    private readonly dataSource: DataSource,
    private readonly lector: LectorComandasService,
  ) {}

  get iaConfigurada(): boolean {
    return this.lector.configurado;
  }

  // ─── Lotes ────────────────────────────────────────────────────────────────

  async crearLote(
    fecha: string,
    archivos: Express.Multer.File[],
    u: UsuarioValidacion,
  ) {
    if (!archivos?.length) throw new BadRequestException('Falta el archivo.');
    const imagenes: ImagenPagina[] = [];
    for (const a of archivos) {
      const nombre = nombreArchivo(a.originalname);
      if (
        a.mimetype === 'application/pdf' ||
        nombre.toLowerCase().endsWith('.pdf')
      ) {
        imagenes.push(...(await imagenesDePdf(a.buffer)));
      } else {
        imagenes.push(imagenSuelta(a.buffer, nombre));
      }
    }
    if (!imagenes.length)
      throw new BadRequestException('El archivo no tiene hojas.');
    if (imagenes.length > MAX_PAGINAS) {
      throw new BadRequestException(
        `Máximo ${MAX_PAGINAS} hojas por lote: dividilo en partes.`,
      );
    }
    imagenes.forEach((p, i) => validarTamano(p, `La hoja ${i + 1}`));

    const id = await this.dataSource.transaction(async (m) => {
      const lote = await m.save(
        m.create(LoteValidacion, {
          fecha,
          nombreArchivo: archivos
            .map((a) => nombreArchivo(a.originalname))
            .join(', ')
            .slice(0, 255),
          estado: EstadoLote.SUBIDO,
          totalPaginas: imagenes.length,
          // explícitos: el transformador numérico convierte "sin valor" en null y pisa el default
          tokensEntrada: 0,
          tokensSalida: 0,
          costoUsd: 0,
          creadoPorId: u.id,
          creadoPorNombre: u.nombre,
        }),
      );
      for (const [i, img] of imagenes.entries()) {
        await m.insert(PaginaValidacion, {
          loteId: lote.id,
          orden: i + 1,
          mimeType: img.mimeType,
          imagen: img.datos,
          estado: EstadoPagina.PENDIENTE,
          tokensEntrada: 0,
          tokensSalida: 0,
          costoUsd: 0,
        });
      }
      return lote.id;
    });
    this.logger.log(
      `Lote ${id}: ${imagenes.length} hojas del ${fecha} subidas por ${u.nombre}`,
    );
    return this.obtenerLote(id);
  }

  async listarLotes() {
    const lotes = await this.lotes.find({
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
    if (!lotes.length) return [];
    const conteos: {
      loteId: string;
      estado: string;
      resultado: string | null;
      n: string;
    }[] = await this.paginas
      .createQueryBuilder('p')
      .select('p.loteId', 'loteId')
      .addSelect('p.estado', 'estado')
      .addSelect('p.resultado', 'resultado')
      .addSelect('COUNT(*)', 'n')
      .where({ loteId: In(lotes.map((l) => l.id)) })
      .groupBy('p.loteId')
      .addGroupBy('p.estado')
      .addGroupBy('p.resultado')
      .getRawMany();
    return lotes.map((l) => ({
      ...l,
      leyendo: this.enCurso.has(l.id),
      resumen: this.resumir(
        conteos
          .filter((c) => c.loteId === l.id)
          .map((c) => ({ ...c, n: Number(c.n) })),
      ),
    }));
  }

  async obtenerLote(id: string) {
    const lote = await this.lotes.findOne({ where: { id } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    const paginas = await this.paginas
      .createQueryBuilder('p')
      .select(COLUMNAS_PAGINA)
      .where('p.loteId = :id', { id })
      .orderBy('p.orden', 'ASC')
      .getMany();

    // Un mismo número en dos hojas: se marca para revisar (foto repetida o número mal leído).
    const veces = new Map<string, number>();
    for (const p of paginas)
      if (p.numeroComanda)
        veces.set(p.numeroComanda, (veces.get(p.numeroComanda) ?? 0) + 1);
    const conRepetidas = paginas.map((p) => ({
      ...p,
      repetida: !!p.numeroComanda && (veces.get(p.numeroComanda) ?? 0) > 1,
    }));

    const faltantes = await this.faltantes(
      lote.fecha,
      new Set(
        paginas.flatMap((p) => (p.numeroComanda ? [p.numeroComanda] : [])),
      ),
    );
    return {
      ...lote,
      leyendo: this.enCurso.has(lote.id),
      iaConfigurada: this.iaConfigurada,
      resumen: this.resumir(
        conRepetidas.map((p) => ({
          estado: p.estado,
          resultado:
            p.repetida && p.resultado === ResultadoPagina.OK
              ? ResultadoPagina.REVISAR
              : p.resultado,
          n: 1,
        })),
      ),
      paginas: conRepetidas,
      faltantes,
    };
  }

  async eliminarLote(id: string) {
    if (this.enCurso.has(id))
      throw new ConflictException(
        'El lote se está leyendo: esperá a que termine.',
      );
    const r = await this.lotes.softDelete(id);
    if (!r.affected) throw new NotFoundException('Lote no encontrado');
  }

  private resumir(
    filas: {
      estado: EstadoPagina | string;
      resultado: ResultadoPagina | string | null;
      n: number;
    }[],
  ) {
    type Fila = { estado: EstadoPagina; resultado: ResultadoPagina | null };
    const suma = (f: (x: Fila) => boolean) =>
      filas.filter((x) => f(x as Fila)).reduce((s, x) => s + x.n, 0);
    return {
      total: suma(() => true),
      pendientes: suma((x) => x.estado === EstadoPagina.PENDIENTE),
      leyendo: suma((x) => x.estado === EstadoPagina.LEYENDO),
      errores: suma((x) => x.estado === EstadoPagina.ERROR),
      ok: suma(
        (x) =>
          x.estado === EstadoPagina.LEIDA && x.resultado === ResultadoPagina.OK,
      ),
      revisar: suma(
        (x) =>
          x.estado === EstadoPagina.LEIDA &&
          x.resultado === ResultadoPagina.REVISAR,
      ),
      noEncontradas: suma(
        (x) =>
          x.estado === EstadoPagina.LEIDA &&
          x.resultado === ResultadoPagina.NO_ENCONTRADA,
      ),
    };
  }

  // ─── Lectura con IA (a pedido) ───────────────────────────────────────────

  /** Lee las hojas pendientes (o con error) del lote. Responde enseguida; la lectura sigue de fondo. */
  async leerLote(id: string) {
    if (!this.lector.configurado) {
      throw new ConflictException(
        'La lectura con IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.',
      );
    }
    const lote = await this.lotes.findOne({ where: { id } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (!this.enCurso.has(id)) {
      // Si este proceso no lo está leyendo, una hoja "leyendo" quedó colgada (reinicio): se reintenta.
      await this.paginas.update(
        { loteId: id, estado: In([EstadoPagina.ERROR, EstadoPagina.LEYENDO]) },
        { estado: EstadoPagina.PENDIENTE },
      );
      void this.procesar(id);
    }
    return this.obtenerLote(id);
  }

  /** Vuelve a leer una hoja con la IA (por ejemplo, después de re-escanearla). */
  async releerPagina(paginaId: string) {
    if (!this.lector.configurado) {
      throw new ConflictException(
        'La lectura con IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.',
      );
    }
    const p = await this.paginas.findOne({ where: { id: paginaId } });
    if (!p) throw new NotFoundException('Hoja no encontrada');
    if (this.enCurso.has(p.loteId))
      throw new ConflictException(
        'El lote se está leyendo: esperá a que termine.',
      );
    await this.paginas.update(paginaId, { estado: EstadoPagina.PENDIENTE });
    void this.procesar(p.loteId);
    return this.obtenerLote(p.loteId);
  }

  private async procesar(loteId: string) {
    if (this.enCurso.has(loteId)) return;
    this.enCurso.add(loteId);
    try {
      const lote = await this.lotes.findOne({ where: { id: loteId } });
      if (!lote) return;
      await this.lotes.update(loteId, { estado: EstadoLote.LEYENDO });
      const pendientes = await this.paginas.find({
        where: { loteId, estado: EstadoPagina.PENDIENTE },
        order: { orden: 'ASC' },
        select: ['id'],
      });
      const cola = pendientes.map((p) => p.id);
      await Promise.all(
        Array.from({ length: CONCURRENCIA }, async () => {
          while (cola.length) await this.leerPagina(cola.shift()!, lote.fecha);
        }),
      );
      await this.lotes.update(loteId, { estado: EstadoLote.LISTO });
    } catch (e) {
      this.logger.error(`Lote ${loteId}: ${(e as Error).message}`);
      await this.lotes
        .update(loteId, { estado: EstadoLote.LISTO })
        .catch(() => undefined);
    } finally {
      this.enCurso.delete(loteId);
    }
  }

  private async leerPagina(paginaId: string, fechaLote: string) {
    await this.paginas.update(paginaId, {
      estado: EstadoPagina.LEYENDO,
      error: null,
    });
    const p = await this.paginas
      .createQueryBuilder('p')
      .addSelect('p.imagen')
      .where('p.id = :paginaId', { paginaId })
      .getOne();
    if (!p) return;
    try {
      const r = await this.lector.leer(
        p.imagen,
        p.mimeType as 'image/jpeg' | 'image/png',
      );
      const cmp = await this.compararLectura(r.lectura, fechaLote);
      await this.paginas.update(paginaId, {
        estado: EstadoPagina.LEIDA,
        lectura: r.lectura,
        ...cmp,
        tokensEntrada: r.tokensEntrada,
        tokensSalida: r.tokensSalida,
        costoUsd: r.costoUsd,
        leidaAt: new Date(),
        error: null,
      });
      await this.lotes
        .createQueryBuilder()
        .update(LoteValidacion)
        .set({
          modelo: r.modelo,
          tokensEntrada: () =>
            `"tokensEntrada" + ${Math.round(r.tokensEntrada)}`,
          tokensSalida: () => `"tokensSalida" + ${Math.round(r.tokensSalida)}`,
          costoUsd: () => `"costoUsd" + ${r.costoUsd.toFixed(6)}`,
        })
        .where('id = :id', { id: p.loteId })
        .execute();
    } catch (e) {
      this.logger.warn(`Hoja ${paginaId}: ${(e as Error).message}`);
      await this.paginas.update(paginaId, {
        estado: EstadoPagina.ERROR,
        error: String((e as Error).message).slice(0, 500),
      });
    }
  }

  /** Vuelve a comparar las hojas ya leídas contra el sistema (sin IA, no se cobra). */
  async recomparar(loteId: string) {
    const lote = await this.lotes.findOne({ where: { id: loteId } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (this.enCurso.has(loteId))
      throw new ConflictException(
        'El lote se está leyendo: esperá a que termine.',
      );
    const leidas = await this.paginas.find({
      where: { loteId, estado: EstadoPagina.LEIDA },
    });
    for (const p of leidas) {
      if (!p.lectura) continue;
      await this.paginas.update(
        p.id,
        await this.compararLectura(p.lectura, lote.fecha),
      );
    }
    return this.obtenerLote(loteId);
  }

  private async compararLectura(lectura: LecturaComanda, fechaLote: string) {
    const numero = numeroSistema(lectura.numero);
    const sistema = numero ? await this.comandaDelSistema(numero) : null;
    if (!sistema) {
      return {
        numeroComanda: numero,
        comandaId: null,
        resultado: ResultadoPagina.NO_ENCONTRADA,
        diferencias: [],
        sistema: null,
      };
    }
    const diferencias = comparar(lectura, sistema, fechaLote);
    return {
      numeroComanda: sistema.numero,
      comandaId: sistema.id,
      resultado: diferencias.length
        ? ResultadoPagina.REVISAR
        : ResultadoPagina.OK,
      diferencias,
      sistema,
    };
  }

  // ─── Datos del sistema (sólo lectura) ────────────────────────────────────

  /** Comanda de ingreso por número ("01-11089"), comparando la parte numérica. */
  private async comandaDelSistema(
    numero: string,
  ): Promise<ComandaSistema | null> {
    const n = Number(numero.split('-')[1]);
    if (!Number.isFinite(n)) return null;
    const filas: ComandaSistema[] = await this.dataSource.query(
      `SELECT c.id, c.numero,
              to_char(c."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
              c."estadoDeComanda"::text AS estado, cl.nombre AS cliente, c.observaciones,
              COALESCE((SELECT json_agg(json_build_object('nombre', i.nombre, 'trabajador', t.nombre))
                          FROM item_comanda i LEFT JOIN trabajadores t ON t.id = i.trabajador_id
                         WHERE i.comanda_id = c.id AND i."deletedAt" IS NULL), '[]') AS items,
              COALESCE((SELECT json_agg(json_build_object('tipo', m.tipo::text, 'moneda', m.moneda::text, 'monto', m.monto_final::float))
                          FROM metodos_pago m WHERE m."comandaId" = c.id AND m."deletedAt" IS NULL), '[]') AS pagos,
              COALESCE((SELECT json_agg(json_build_object('moneda', p.moneda::text, 'monto', p.monto::float))
                          FROM prepagos_guardados p WHERE p.id IN (c."prepagoARSID", c."prepagoUSDID")), '[]') AS senas
         FROM comandas c LEFT JOIN clientes cl ON cl.id = c."clienteId"
        WHERE c."deletedAt" IS NULL AND c."tipoDeComanda" = 'INGRESO'
          AND split_part(c.numero, '-', 1) = '01'
          AND (CASE WHEN split_part(c.numero, '-', 2) ~ '^[0-9]+$' THEN split_part(c.numero, '-', 2)::bigint END) = $1
        ORDER BY c."createdAt" DESC
        LIMIT 1`,
      [n],
    );
    return filas[0] ?? null;
  }

  /** Comandas de ingreso cargadas ese día que no aparecen en ninguna hoja del lote. */
  private async faltantes(fecha: string, presentes: Set<string>) {
    const filas: {
      id: string;
      numero: string;
      cliente: string | null;
      estado: string;
    }[] = await this.dataSource.query(
      `SELECT c.id, c.numero, cl.nombre AS cliente, c."estadoDeComanda"::text AS estado
         FROM comandas c LEFT JOIN clientes cl ON cl.id = c."clienteId"
        WHERE c."deletedAt" IS NULL AND c."tipoDeComanda" = 'INGRESO'
          AND (c."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $1::date
        ORDER BY c.numero`,
      [fecha],
    );
    return filas.filter((f) => !presentes.has(f.numero));
  }

  async imagen(paginaId: string) {
    const p = await this.paginas
      .createQueryBuilder('p')
      .addSelect('p.imagen')
      .where('p.id = :paginaId', { paginaId })
      .getOne();
    if (!p) throw new NotFoundException('Hoja no encontrada');
    return p;
  }
}
