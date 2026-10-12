import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import whatsappConfig from '../../config/whatsapp.config';

export type EstadoCentral = 'bot' | 'handoff' | 'closed';

export interface ConversacionCentral {
  conversation_id: string;
  status: EstadoCentral;
  paused: boolean;
}

export interface ConfigCentral {
  bot?: { status?: string };
  features?: {
    test_mode?: { enabled?: boolean; on_cmd?: string; off_cmd?: string } | null;
  };
}

const TIMEOUT_MS = 8_000;

/**
 * Cliente HTTP hacia la central de chatbots. Habla el mismo contrato que un
 * motor estándar, autenticado con el token del bot.
 *
 * Todo es "mejor esfuerzo": si la central no responde se loguea y se sigue.
 * El WhatsApp de Mery nunca depende de que la central esté arriba.
 */
@Injectable()
export class CentralClient {
  private readonly logger = new Logger(CentralClient.name);

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly cfg: ConfigType<typeof whatsappConfig>,
  ) {}

  get configurada(): boolean {
    const c = this.cfg.central;
    return !!c.url && !!c.botId && !!c.token;
  }

  get urlComandos(): string {
    return `${this.base}/commands`;
  }

  get cabeceras(): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.central.token}` };
  }

  private get base(): string {
    return `${this.cfg.central.url}/v1/bots/${this.cfg.central.botId}`;
  }

  private async pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${ruta}`, {
      method: metodo,
      headers: { ...this.cabeceras, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${metodo} ${ruta} → ${res.status}`);
    return (await res.json()) as T;
  }

  obtenerConfig(): Promise<ConfigCentral> {
    return this.pedir('GET', '/config');
  }

  upsertConversacion(telefono: string, nombre: string | null): Promise<ConversacionCentral> {
    return this.pedir('POST', '/conversations/upsert', {
      contact_phone: telefono,
      contact_name: nombre ?? undefined,
      contact_network: 'whatsapp',
    });
  }

  registrarMensaje(dto: {
    conversation_id: string;
    direction: 'inbound' | 'outbound';
    sender: 'customer' | 'bot' | 'agent';
    body: string | null;
    media_url: string | null;
    meta?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.pedir('POST', '/messages', dto);
  }

  /** Sube un adjunto a la central. Devuelve la URL, o null si no pudo. */
  async subirArchivo(datos: Buffer, mimeType: string, nombre: string): Promise<string | null> {
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(datos)], { type: mimeType }), nombre);
      const res = await fetch(`${this.base}/media`, {
        method: 'POST',
        headers: this.cabeceras,
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`POST /media → ${res.status}`);
      return ((await res.json()) as { url: string | null }).url ?? null;
    } catch (error) {
      this.logger.warn(`No se pudo subir un adjunto a la central: ${(error as Error).message}`);
      return null;
    }
  }

  /** La charla pasa a una persona, con el aviso de "pidió hablar con alguien". */
  derivar(conversationId: string, motivo: string): Promise<{ ok: boolean }> {
    return this.pedir('POST', '/capabilities/derivar_humano/execute', {
      conversation_id: conversationId,
      params: { reason: motivo, motivo },
      confirmed: true,
    });
  }

  /** Una persona ya la está atendiendo: se pausa sin alerta. */
  tomar(conversationId: string): Promise<{ ok: boolean }> {
    return this.pedir('POST', `/conversations/${conversationId}/takeover`);
  }

  devolverAlBot(conversationId: string): Promise<{ ok: boolean }> {
    return this.pedir('POST', `/conversations/${conversationId}/resume`);
  }

  cerrar(conversationId: string): Promise<{ ok: boolean; error_code?: string }> {
    return this.pedir('POST', `/conversations/${conversationId}/close`, { reason: '' });
  }

  estadoCanal(estado: 'connected' | 'qr_pending' | 'disconnected', telefono?: string | null): Promise<unknown> {
    return this.pedir('POST', '/channel/status', {
      session_status: estado,
      qr: null,
      phone_number: telefono ?? undefined,
    });
  }
}
