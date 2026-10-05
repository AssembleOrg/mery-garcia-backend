import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { EstadoLote, LoteValidacion } from './entities/loteValidacion.entity';
import {
  EstadoPagina,
  PaginaValidacion,
  ResultadoPagina,
  RevisionPagina,
} from './entities/paginaValidacion.entity';
import {
  LectorComandasService,
  type LecturaComanda,
  type ResultadoLectura,
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
  'p.huella',
  'p.lecturaDeId',
  'p.revision',
  'p.revisionNota',
  'p.revisadoPorId',
  'p.revisadoPorNombre',
  'p.revisadoAt',
  'p.createdAt',
];

/** Al cambiar la comparación, la revisión humana anterior deja de valer. */
const SIN_REVISION = {
  revision: null,
  revisionNota: null,
  revisadoPorId: null,
  revisadoPorNombre: null,
  revisadoAt: null,
};

function nombreArchivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  return (utf8.includes('�') ? original : utf8).slice(0, 255);
}

/**
 * Validación de comandas en papel con IA. Todo es a pedido:
 * - subir un lote NO lee nada;
 * - "leer" manda cada hoja a la IA (se cobra) y compara contra el sistema;
 *   si la misma foto ya se leyó antes (misma huella), reutiliza esa lectura gratis;
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
          huella: createHash('sha256').update(img.datos).digest('hex'),
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
      revision: string | null;
      n: string;
    }[] = await this.paginas
      .createQueryBuilder('p')
      .select('p.loteId', 'loteId')
      .addSelect('p.estado', 'estado')
      .addSelect('p.resultado', 'resultado')
      .addSelect('p.revision', 'revision')
      .addSelect('COUNT(*)', 'n')
      .where({ loteId: In(lotes.map((l) => l.id)) })
      .groupBy('p.loteId')
      .addGroupBy('p.estado')
      .addGroupBy('p.resultado')
      .addGroupBy('p.revision')
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
    const previas = await this.lecturasPrevias(
      paginas.filter((p) => !p.lectura && p.estado !== EstadoPagina.LEYENDO),
    );
    return {
      ...lote,
      leyendo: this.enCurso.has(lote.id),
      iaConfigurada: this.iaConfigurada,
      /** Hojas sin leer cuya foto ya se leyó en otro lote: al leer, no se cobran. */
      reutilizables: previas.size,
      resumen: this.resumir(
        conRepetidas.map((p) => ({
          estado: p.estado,
          resultado:
            p.repetida && p.resultado === ResultadoPagina.OK
              ? ResultadoPagina.REVISAR
              : p.resultado,
          revision: p.revision,
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

  /**
   * OK = la IA no encontró diferencias. Pendiente de aprobación = hay
   * diferencias (o el número no está en el sistema) y nadie la revisó todavía.
   * Aprobada / con error = lo decidió una persona.
   */
  private resumir(
    filas: {
      estado: EstadoPagina | string;
      resultado: ResultadoPagina | string | null;
      revision: RevisionPagina | string | null;
      n: number;
    }[],
  ) {
    type Fila = {
      estado: EstadoPagina;
      resultado: ResultadoPagina | null;
      revision: RevisionPagina | null;
    };
    const suma = (f: (x: Fila) => boolean) =>
      filas.filter((x) => f(x as Fila)).reduce((s, x) => s + x.n, 0);
    const leida = (x: Fila) => x.estado === EstadoPagina.LEIDA;
    return {
      total: suma(() => true),
      sinLeer: suma((x) => x.estado === EstadoPagina.PENDIENTE),
      leyendo: suma((x) => x.estado === EstadoPagina.LEYENDO),
      errores: suma((x) => x.estado === EstadoPagina.ERROR),
      ok: suma(
        (x) => leida(x) && !x.revision && x.resultado === ResultadoPagina.OK,
      ),
      pendientesAprobacion: suma(
        (x) => leida(x) && !x.revision && x.resultado !== ResultadoPagina.OK,
      ),
      aprobadas: suma(
        (x) => leida(x) && x.revision === RevisionPagina.APROBADA,
      ),
      conError: suma(
        (x) => leida(x) && x.revision === RevisionPagina.CON_ERROR,
      ),
      noEncontradas: suma(
        (x) => leida(x) && x.resultado === ResultadoPagina.NO_ENCONTRADA,
      ),
    };
  }

  // ─── Revisión humana ─────────────────────────────────────────────────────

  /** Una persona aprueba la hoja o marca que hay un error real (con nota). No toca la comanda. */
  async revisar(
    paginaId: string,
    decision: RevisionPagina,
    nota: string | undefined,
    u: UsuarioValidacion,
  ) {
    const p = await this.paginas.findOne({ where: { id: paginaId } });
    if (!p) throw new NotFoundException('Hoja no encontrada');
    if (p.estado !== EstadoPagina.LEIDA) {
      throw new ConflictException('La hoja todavía no se leyó.');
    }
    const texto = nota?.trim() || null;
    if (decision === RevisionPagina.CON_ERROR && !texto) {
      throw new BadRequestException(
        'Contá cuál es el error, para poder corregirlo.',
      );
    }
    await this.paginas.update(paginaId, {
      revision: decision,
      revisionNota: texto,
      revisadoPorId: u.id,
      revisadoPorNombre: u.nombre,
      revisadoAt: new Date(),
    });
    this.logger.log(`Hoja ${paginaId} ${decision} por ${u.nombre}`);
    return this.obtenerLote(p.loteId);
  }

  async deshacerRevision(paginaId: string) {
    const p = await this.paginas.findOne({ where: { id: paginaId } });
    if (!p) throw new NotFoundException('Hoja no encontrada');
    await this.paginas.update(paginaId, SIN_REVISION);
    return this.obtenerLote(p.loteId);
  }

  /** El "gemelo digital": la comanda tal como está hoy en el sistema. */
  async gemelo(numero: string) {
    const c = await this.comandaDelSistema(numero);
    if (!c)
      throw new NotFoundException(
        'No hay ninguna comanda de ingreso con ese número.',
      );
    return c;
  }

  // ─── Lectura con IA (a pedido) ───────────────────────────────────────────

  /**
   * Lee las hojas pendientes (o con error) del lote. Responde enseguida; la
   * lectura con IA sigue de fondo. Nunca se paga dos veces por lo mismo: lo que
   * ya tiene lectura sólo se vuelve a comparar, y una foto ya leída en otro lote
   * (misma huella) reutiliza esa lectura.
   */
  async leerLote(id: string) {
    const lote = await this.lotes.findOne({ where: { id } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (this.enCurso.has(id)) return this.obtenerLote(id);

    // Si este proceso no lo está leyendo, una hoja "leyendo" quedó colgada (reinicio).
    const porLeer = await this.paginas.find({
      where: {
        loteId: id,
        estado: In([
          EstadoPagina.PENDIENTE,
          EstadoPagina.ERROR,
          EstadoPagina.LEYENDO,
        ]),
      },
      order: { orden: 'ASC' },
    });
    const previas = await this.lecturasPrevias(
      porLeer.filter((p) => !p.lectura),
    );
    const paraIa = porLeer.filter((p) => !p.lectura && !previas.has(p.id));
    if (paraIa.length && !this.lector.configurado) {
      throw new ConflictException(
        'La lectura con IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.',
      );
    }

    for (const p of porLeer) {
      const previa = previas.get(p.id);
      if (p.lectura) {
        await this.compararYGuardar(p.id, p.lectura, lote.fecha);
      } else if (previa) {
        await this.paginas.update(p.id, {
          lectura: previa.lectura,
          lecturaDeId: previa.id,
          tokensEntrada: 0,
          tokensSalida: 0,
          costoUsd: 0,
          leidaAt: new Date(),
          error: null,
          ...SIN_REVISION,
        });
        await this.compararYGuardar(p.id, previa.lectura, lote.fecha);
      } else if (p.estado !== EstadoPagina.PENDIENTE) {
        await this.paginas.update(p.id, { estado: EstadoPagina.PENDIENTE });
      }
    }
    if (previas.size) {
      this.logger.log(
        `Lote ${id}: ${previas.size} hojas reutilizan una lectura anterior (sin costo)`,
      );
    }
    if (paraIa.length) void this.procesar(id);
    else if (porLeer.length)
      await this.lotes.update(id, { estado: EstadoLote.LISTO });
    return this.obtenerLote(id);
  }

  /**
   * Lectura ya pagada de la misma foto (misma huella) en otra hoja, incluso de
   * un lote borrado. Devuelve, por hoja, la más reciente.
   */
  private async lecturasPrevias(
    paginas: Pick<PaginaValidacion, 'id' | 'huella'>[],
  ) {
    const previas = new Map<string, { id: string; lectura: LecturaComanda }>();
    const huellas = [
      ...new Set(paginas.flatMap((p) => (p.huella ? [p.huella] : []))),
    ];
    if (!huellas.length) return previas;
    const filas: { huella: string; id: string; lectura: LecturaComanda }[] =
      await this.dataSource.query(
        `SELECT DISTINCT ON (huella) huella, id, lectura
           FROM validacion_paginas
          WHERE huella = ANY($1) AND lectura IS NOT NULL
          ORDER BY huella, "leidaAt" DESC NULLS LAST`,
        [huellas],
      );
    const porHuella = new Map(filas.map((f) => [f.huella, f]));
    for (const p of paginas) {
      const f = p.huella ? porHuella.get(p.huella) : undefined;
      if (f && f.id !== p.id)
        previas.set(p.id, { id: f.id, lectura: f.lectura });
    }
    return previas;
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
          while (cola.length) {
            const paginaId = cola.shift()!;
            // Cada hoja falla por separado: un error nunca corta la lectura del resto del lote.
            try {
              await this.leerPagina(paginaId, lote.fecha);
            } catch (e) {
              this.logger.error(`Hoja ${paginaId}: ${(e as Error).message}`);
              await this.paginas
                .update(paginaId, {
                  estado: EstadoPagina.ERROR,
                  error: String((e as Error).message).slice(0, 500),
                })
                .catch(() => undefined);
            }
          }
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
    let r: ResultadoLectura;
    try {
      r = await this.lector.leer(
        p.imagen,
        p.mimeType as 'image/jpeg' | 'image/png',
      );
    } catch (e) {
      this.logger.warn(`Hoja ${paginaId}: ${(e as Error).message}`);
      await this.paginas.update(paginaId, {
        estado: EstadoPagina.ERROR,
        error: String((e as Error).message).slice(0, 500),
      });
      return;
    }
    // La lectura ya está pagada: se guarda antes de comparar, así un error al
    // comparar no obliga a leer de nuevo (se reintenta sin IA).
    await this.paginas.update(paginaId, {
      lectura: r.lectura,
      lecturaDeId: null,
      tokensEntrada: r.tokensEntrada,
      tokensSalida: r.tokensSalida,
      costoUsd: r.costoUsd,
      leidaAt: new Date(),
      ...SIN_REVISION,
    });
    await this.lotes
      .createQueryBuilder()
      .update(LoteValidacion)
      .set({
        modelo: r.modelo,
        tokensEntrada: () => `"tokensEntrada" + ${Math.round(r.tokensEntrada)}`,
        tokensSalida: () => `"tokensSalida" + ${Math.round(r.tokensSalida)}`,
        costoUsd: () => `"costoUsd" + ${r.costoUsd.toFixed(6)}`,
      })
      .where('id = :id', { id: p.loteId })
      .execute();
    await this.compararYGuardar(paginaId, r.lectura, fechaLote);
  }

  /**
   * Compara una lectura ya guardada contra el sistema. Si falla, la hoja queda
   * en error pero conserva la lectura. Si la comparación cambió respecto de la
   * anterior, la revisión humana se borra (ya no es la misma comparación).
   */
  private async compararYGuardar(
    paginaId: string,
    lectura: LecturaComanda,
    fechaLote: string,
    anterior?: Pick<PaginaValidacion, 'resultado' | 'diferencias'>,
  ) {
    try {
      const nueva = await this.compararLectura(lectura, fechaLote);
      const cambio =
        !anterior ||
        nueva.resultado !== anterior.resultado ||
        JSON.stringify(nueva.diferencias) !==
          JSON.stringify(anterior.diferencias ?? []);
      await this.paginas.update(paginaId, {
        estado: EstadoPagina.LEIDA,
        error: null,
        ...nueva,
        ...(cambio ? SIN_REVISION : {}),
      });
    } catch (e) {
      this.logger.warn(
        `Hoja ${paginaId} (comparación): ${(e as Error).message}`,
      );
      await this.paginas.update(paginaId, {
        estado: EstadoPagina.ERROR,
        error: `No se pudo comparar con el sistema: ${String((e as Error).message).slice(0, 400)}`,
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
    const conLectura = await this.paginas.find({
      where: { loteId, estado: In([EstadoPagina.LEIDA, EstadoPagina.ERROR]) },
    });
    for (const p of conLectura) {
      if (!p.lectura) continue;
      await this.compararYGuardar(
        p.id,
        p.lectura,
        lote.fecha,
        p.estado === EstadoPagina.LEIDA ? p : undefined,
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
              c."precioPesos"::float AS "precioPesos", c."precioDolar"::float AS "precioDolar", pe.nombre AS "cargadaPor",
              COALESCE((SELECT json_agg(json_build_object('nombre', i.nombre, 'trabajador', t.nombre, 'cantidad', i.cantidad, 'subtotal', i.subtotal::float))
                          FROM item_comanda i LEFT JOIN trabajadores t ON t.id = i.trabajador_id
                         WHERE i.comanda_id = c.id AND i."deletedAt" IS NULL), '[]') AS items,
              COALESCE((SELECT json_agg(json_build_object('tipo', m.tipo::text, 'moneda', m.moneda::text, 'monto', m.monto_final::float))
                          FROM metodos_pago m WHERE m."comandaId" = c.id AND m."deletedAt" IS NULL), '[]') AS pagos,
              COALESCE((SELECT json_agg(json_build_object('moneda', p.moneda::text, 'monto', p.monto::float, 'tipoPago', p."tipoPago"::text))
                          FROM prepagos_guardados p WHERE p.id IN (c."prepagoARSID", c."prepagoUSDID")), '[]') AS senas
         FROM comandas c LEFT JOIN clientes cl ON cl.id = c."clienteId"
         LEFT JOIN personal pe ON pe.id = c."creadoPorId"
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
