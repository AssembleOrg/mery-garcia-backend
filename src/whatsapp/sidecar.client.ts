import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import whatsappConfig from '../config/whatsapp.config';

export interface EstadoSidecar {
  configurado: boolean;
  alcanzable: boolean;
  connected: boolean;
  loggedIn: boolean;
  qr: string | null;
  qrAgeSeconds: number | null;
  pairingExpired: boolean;
  pairingAttempts: number;
  pairingMaxAttempts: number;
  pairingAutoRefresh: boolean;
}

/** Cliente HTTP del sidecar neonize. Autenticación por secret compartido. */
@Injectable()
export class SidecarClient {
  private readonly logger = new Logger(SidecarClient.name);
  private readonly http: AxiosInstance;

  constructor(
    @Inject(whatsappConfig.KEY)
    private readonly cfg: ConfigType<typeof whatsappConfig>,
  ) {
    this.http = axios.create({
      baseURL: this.cfg.sidecarUrl,
      headers: { 'X-Sidecar-Secret': this.cfg.sidecarSecret },
      // Un adjunto grande + conversión ffmpeg + "grabando" humanizado.
      timeout: 90_000,
      maxBodyLength: 30 * 1024 * 1024,
    });
  }

  get configurado(): boolean {
    return Boolean(this.cfg.sidecarUrl && this.cfg.sidecarSecret);
  }

  async estado(): Promise<EstadoSidecar> {
    const base: EstadoSidecar = {
      configurado: this.configurado,
      alcanzable: false,
      connected: false,
      loggedIn: false,
      qr: null,
      qrAgeSeconds: null,
      pairingExpired: false,
      pairingAttempts: 0,
      pairingMaxAttempts: 0,
      pairingAutoRefresh: false,
    };
    if (!this.configurado) return base;
    try {
      const { data } = await this.http.get('/status', { timeout: 8_000 });
      return { ...base, alcanzable: true, ...data };
    } catch (error) {
      this.logger.warn(`Sidecar sin respuesta: ${(error as Error).message}`);
      return base;
    }
  }

  async enviarTexto(to: string, text: string, typing = true): Promise<string | null> {
    const { data } = await this.http.post('/send', { to, text, typing });
    return data?.id ?? null;
  }

  async enviarAudio(to: string, datos: Buffer): Promise<string | null> {
    const { data } = await this.http.post('/send-audio', {
      to,
      base64: datos.toString('base64'),
    });
    return data?.id ?? null;
  }

  async enviarArchivo(
    to: string,
    datos: Buffer,
    mime: string,
    fileName: string,
    caption?: string | null,
  ): Promise<string | null> {
    const { data } = await this.http.post('/send-file', {
      to,
      base64: datos.toString('base64'),
      mime,
      fileName,
      caption: caption ?? null,
    });
    return data?.id ?? null;
  }

  /** Tilde azul. Best-effort: si falla no pasa nada grave. */
  async marcarLeidos(to: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    try {
      await this.http.post('/read', { to, messageIds }, { timeout: 10_000 });
    } catch (error) {
      this.logger.warn(`No se pudo marcar leído: ${(error as Error).message}`);
    }
  }

  async refrescarSesion(): Promise<void> {
    await this.http.post('/session/refresh', {}, { timeout: 10_000 });
  }

  async reiniciar(): Promise<void> {
    await this.http.post('/restart', {}, { timeout: 10_000 });
  }

  async cerrarSesion(): Promise<void> {
    await this.http.post('/logout', {}, { timeout: 15_000 });
  }
}
