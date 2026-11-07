import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import costearConfig from '../config/costear.config';
import { ComprobanteCompra } from './entities/PedidoCompra.entity';

/** Estado que anotamos mientras Costear lo lee o si no lo pudimos mandar. */
export const COSTEAR_PENDIENTE = 'PENDIENTE';
export const COSTEAR_ERROR = 'ERROR';

interface RespuestaCostear {
  id?: string;
  status?: string;
  summary?: string | null;
}

/**
 * Manda los comprobantes de compras a Costear (lo mismo que /validar): Costear
 * los lee, los concilia con el banco y los deja como gasto del salón.
 */
@Injectable()
export class CostearComprobantesService {
  private readonly logger = new Logger(CostearComprobantesService.name);

  constructor(
    @Inject(costearConfig.KEY)
    private readonly cfg: ConfigType<typeof costearConfig>,
    @InjectRepository(ComprobanteCompra)
    private readonly comprobantes: Repository<ComprobanteCompra>,
  ) {}

  get configurado(): boolean {
    return !!this.cfg.apiUrl && !!this.cfg.comprobantesSecret;
  }

  /** Sin esperar: lo que falle queda anotado en el comprobante. */
  enviarEnSegundoPlano(ids: string[]): void {
    if (!this.configurado) return;
    for (const id of ids) {
      this.enviar(id).catch((err) =>
        this.logger.error(`Comprobante ${id} a Costear: ${String(err)}`),
      );
    }
  }

  async enviar(id: string): Promise<ComprobanteCompra> {
    if (!this.configurado)
      throw new ServiceUnavailableException(
        'La conexión con Costear no está configurada.',
      );
    const c = await this.comprobantes
      .createQueryBuilder('c')
      .addSelect('c.datos')
      .leftJoinAndSelect('c.pedido', 'p')
      .leftJoinAndSelect('p.proveedores', 'pr')
      .withDeleted()
      .where('c.id = :id', { id })
      .getOne();
    if (!c) throw new NotFoundException('Comprobante no encontrado');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(c.datos)], { type: c.mimeType }),
      c.nombre,
    );
    // Mismo archivo, mismo id: Costear no lo carga dos veces.
    form.append('externalId', `mery-compra-${c.id}`);
    form.append('note', notaParaCostear(c));

    try {
      const res = await fetch(`${this.cfg.apiUrl}/partners/receipts`, {
        method: 'POST',
        headers: { 'X-Receipts-Secret': this.cfg.comprobantesSecret },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      const r = await leer(res);
      c.costearId = r.id ?? c.costearId;
      c.costearEstado = r.status ?? COSTEAR_PENDIENTE;
      c.costearDetalle = r.summary?.slice(0, 300) ?? null;
    } catch (err) {
      c.costearEstado = COSTEAR_ERROR;
      c.costearDetalle = mensaje(err).slice(0, 300);
    }
    c.costearEnviadoAt = new Date();
    await this.comprobantes.update(c.id, {
      costearId: c.costearId,
      costearEstado: c.costearEstado,
      costearDetalle: c.costearDetalle,
      costearEnviadoAt: c.costearEnviadoAt,
    });
    return c;
  }

  /** Pregunta a Costear cómo quedó la lectura. */
  async actualizarEstado(id: string): Promise<ComprobanteCompra> {
    if (!this.configurado)
      throw new ServiceUnavailableException(
        'La conexión con Costear no está configurada.',
      );
    const c = await this.comprobantes.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    if (!c.costearId) return this.enviar(id);
    try {
      const res = await fetch(
        `${this.cfg.apiUrl}/partners/receipts/${encodeURIComponent(c.costearId)}`,
        {
          headers: { 'X-Receipts-Secret': this.cfg.comprobantesSecret },
          signal: AbortSignal.timeout(15_000),
        },
      );
      const r = await leer(res);
      c.costearEstado = r.status ?? c.costearEstado;
      c.costearDetalle = r.summary?.slice(0, 300) ?? c.costearDetalle;
    } catch (err) {
      // Sin respuesta no cambiamos lo que ya sabíamos.
      this.logger.warn(`Estado en Costear de ${id}: ${mensaje(err)}`);
      return c;
    }
    await this.comprobantes.update(c.id, {
      costearEstado: c.costearEstado,
      costearDetalle: c.costearDetalle,
    });
    return c;
  }
}

/** "Compra N° 12 · Oui Classy · Reposición descartables" */
export function notaParaCostear(c: ComprobanteCompra): string {
  const p = c.pedido;
  const partes = [`Compra N° ${p.numero}`];
  const proveedores = (p.proveedores ?? [])
    .map((x) => x.nombre)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .join(', ');
  if (proveedores) partes.push(proveedores);
  if (p.titulo) partes.push(p.titulo);
  return partes.join(' · ').slice(0, 300);
}

async function leer(res: Response): Promise<RespuestaCostear> {
  const texto = await res.text();
  if (!res.ok)
    throw new Error(`Costear respondió ${res.status}: ${texto.slice(0, 200)}`);
  const body = JSON.parse(texto) as {
    data?: RespuestaCostear;
  } & RespuestaCostear;
  return body.data ?? body;
}

function mensaje(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
