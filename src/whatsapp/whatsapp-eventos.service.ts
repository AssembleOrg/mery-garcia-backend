import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';

/** Lo que el navegador recibe por SSE en cada mensaje. */
export interface EventoWhatsapp {
  type: 'mensaje' | 'conversacion' | 'notificacion' | 'ping';
  data: unknown;
}

const LATIDO_MS = 25_000;

/**
 * Bus en vivo del WhatsApp: mensajes nuevos, cambios de estado de una charla y
 * notificaciones. La web escucha por SSE y se actualiza sola.
 *
 * Vive en memoria: con una sola instancia del backend (el caso) alcanza.
 */
@Injectable()
export class WhatsappEventosService {
  private readonly bus = new Subject<EventoWhatsapp>();

  stream(): Observable<EventoWhatsapp> {
    const latidos = interval(LATIDO_MS).pipe(
      map((): EventoWhatsapp => ({ type: 'ping', data: { ts: new Date().toISOString() } })),
    );
    return merge(this.bus, latidos);
  }

  publicar(type: EventoWhatsapp['type'], data: unknown): void {
    this.bus.next({ type, data });
  }
}
