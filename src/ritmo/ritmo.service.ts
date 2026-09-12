import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  CrearPersonaDto,
  FicharDto,
  LiquidacionParams,
  ResolverIncidenciasDto,
  RitmoErrorBody,
  RitmoOk,
  SolicitarLicenciaDto,
} from './ritmo.types';

/** Error tipado equivalente al RitmoError del SDK. */
export class RitmoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'RitmoError';
  }
}

@Injectable()
export class RitmoService {
  private readonly logger = new Logger(RitmoService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config.get<string>('ritmo.baseUrl');
    this.apiKey = this.config.get<string>('ritmo.apiKey');
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
    });
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Ritmo no configurado: falta RITMO_API_KEY',
      );
    }
  }

  /**
   * Núcleo de request. Agrega Authorization y, opcional, X-Ritmo-User para
   * actuar en nombre de una persona (sólo clave ADMIN). Mapea el envelope
   * de error de Ritmo a RitmoError.
   */
  private async request<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    opts: {
      body?: unknown;
      params?: Record<string, unknown>;
      actingAsUserId?: string;
    } = {},
  ): Promise<T> {
    this.ensureConfigured();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (opts.actingAsUserId) headers['X-Ritmo-User'] = opts.actingAsUserId;

    const cfg: AxiosRequestConfig = {
      method,
      url: path,
      headers,
      params: opts.params,
      data: opts.body,
    };

    try {
      const res = await this.http.request<RitmoOk<T>>(cfg);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const body = err.response.data as RitmoErrorBody | undefined;
        const code = body?.error?.code ?? 'INTERNAL_ERROR';
        const message =
          body?.error?.message ?? err.message ?? 'Error llamando a Ritmo';
        this.logger.error(
          `Ritmo ${method.toUpperCase()} ${path} → ${err.response.status} ${code} (requestId=${body?.meta?.requestId})`,
        );
        throw new RitmoError(
          code,
          message,
          err.response.status,
          body?.error?.details,
          body?.meta?.requestId,
        );
      }
      this.logger.error(
        `Ritmo ${method.toUpperCase()} ${path} → red/timeout: ${(err as Error).message}`,
      );
      throw new RitmoError(
        'NETWORK_ERROR',
        (err as Error).message,
        0,
        undefined,
        undefined,
      );
    }
  }

  // ===================== Consola (gestión) =====================

  /** Quién está / falta ahora. */
  consolaHoy(): Promise<unknown> {
    return this.request('get', '/api/consola/hoy');
  }

  /** Asistencia de la semana (desde = lunes, YYYY-MM-DD). */
  consolaSemana(desde?: string): Promise<unknown> {
    return this.request('get', '/api/consola/semana', {
      params: desde ? { desde } : undefined,
    });
  }

  listarPersonal(): Promise<unknown> {
    return this.request('get', '/api/consola/personal');
  }

  /** Alta de persona con invitación. */
  crearPersona(dto: CrearPersonaDto): Promise<unknown> {
    return this.request('post', '/api/consola/personal', { body: dto });
  }

  /** PATCH persona (incluye active para dar/quitar acceso). */
  actualizarPersona(
    body: { id: string; active?: boolean } & Record<string, unknown>,
  ): Promise<unknown> {
    return this.request('patch', '/api/consola/personal', { body });
  }

  /** Planificador de turnos desde una fecha (YYYY-MM-DD, lunes de la semana). */
  obtenerPlanificador(desde: string): Promise<unknown> {
    return this.request('get', '/api/consola/planificador', {
      params: { desde },
    });
  }

  crearTurnos(body: unknown): Promise<unknown> {
    return this.request('post', '/api/consola/planificador', { body });
  }

  /** Publica la semana (weekStart = lunes, YYYY-MM-DD): recién ahí la gente la ve. */
  publicarSemana(weekStart: string): Promise<{ published: number }> {
    return this.request('post', '/api/consola/planificador', {
      body: { publish: weekStart },
    });
  }

  listarIncidencias(): Promise<unknown> {
    return this.request('get', '/api/consola/incidencias');
  }

  resolverIncidencias(dto: ResolverIncidenciasDto): Promise<unknown> {
    return this.request('post', '/api/consola/incidencias', { body: dto });
  }

  /** Liquidación de horas por persona y concepto (formato JSON). */
  liquidacion(params: LiquidacionParams): Promise<{ rows: unknown[] }> {
    return this.request('get', '/api/consola/liquidacion', {
      params: { ...params, formato: 'json' },
    });
  }

  // ===================== App (persona que ficha) =====================
  // Requiere clave ADMIN + actingAsUserId (X-Ritmo-User).

  /** Jornada de hoy de una persona. */
  appHoy(userId: string): Promise<unknown> {
    return this.request('get', '/api/app/hoy', { actingAsUserId: userId });
  }

  /** Registrar una marca (ENTRADA/SALIDA/…) en nombre de una persona. */
  fichar(userId: string, dto: FicharDto): Promise<unknown> {
    return this.request('post', '/api/app/fichar', {
      body: dto,
      actingAsUserId: userId,
    });
  }

  /** Solicitar licencia/ausencia en nombre de una persona. */
  solicitarLicencia(
    userId: string,
    dto: SolicitarLicenciaDto,
  ): Promise<unknown> {
    return this.request('post', '/api/app/licencias', {
      body: dto,
      actingAsUserId: userId,
    });
  }
}
