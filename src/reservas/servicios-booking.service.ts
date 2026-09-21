import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import bookingConfig from '../config/booking.config';

export interface ServicioBooking {
  id: string;
  nombre: string;
  categoria: string | null;
}

interface RespuestaServicio {
  id: string;
  name: string;
  category?: { name?: string } | null;
  categoryId?: string | null;
}

/** Cuánto se cachea la lista (los servicios de turnos casi no cambian). */
const CACHE_MS = 30 * 60_000;

/**
 * Lista de servicios del sistema de turnos (booking), para elegir a qué
 * servicio apunta una seña cargada a mano. Se lee de la API pública de booking
 * y se cachea; si booking no responde, se devuelve lo último que se supo.
 */
@Injectable()
export class ServiciosBookingService {
  private readonly logger = new Logger(ServiciosBookingService.name);
  private cache: ServicioBooking[] = [];
  private cacheAt = 0;

  constructor(
    @Inject(bookingConfig.KEY)
    private readonly cfg: ConfigType<typeof bookingConfig>,
  ) {}

  async listar(): Promise<ServicioBooking[]> {
    if (this.cache.length && Date.now() - this.cacheAt < CACHE_MS) {
      return this.cache;
    }
    try {
      const { data } = await axios.get(`${this.cfg.apiUrl}/api/services/visible/all`, {
        timeout: 10_000,
      });
      const lista: RespuestaServicio[] = Array.isArray(data) ? data : (data?.data ?? []);
      this.cache = lista
        .filter((s) => s?.name)
        .map((s) => ({
          id: String(s.id),
          nombre: s.name,
          categoria: s.category?.name ?? null,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      this.cacheAt = Date.now();
      return this.cache;
    } catch (error) {
      this.logger.warn(`No se pudo leer los servicios de turnos: ${(error as Error).message}`);
      return this.cache; // lo último conocido (o vacío)
    }
  }
}
