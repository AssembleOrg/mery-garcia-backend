import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSuscripcion } from './entities/PushSuscripcion.entity';
import { Personal } from '../personal/entities/Personal.entity';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { SuscribirPushDto } from './dto/push.dto';

/** Lo que muestra la notificación (lo arma el service worker de la web). */
export interface MensajePush {
  titulo: string;
  cuerpo: string;
  /** Ruta de la web a la que lleva al tocarla. */
  enlace?: string | null;
  /** Agrupa: una nueva con el mismo tag reemplaza a la anterior. */
  tag?: string;
}

/**
 * Sólo se aceptan endpoints de los servicios de push de los navegadores: el
 * backend hace un POST a esa URL, y sin esta lista cualquiera con sesión
 * podría hacerlo pegarle a una dirección arbitraria.
 */
const HOSTS_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

/**
 * Notificaciones push (Web Push con VAPID). Llegan con la web cerrada; en
 * iPhone sólo si la web está agregada a la pantalla de inicio (iOS 16.4+).
 *
 * Sin VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT queda apagado: no rompe nada, sólo
 * no manda. Las claves se generan una vez con `npx web-push generate-vapid-keys`.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private clavePublica: string | null = null;

  constructor(
    @InjectRepository(PushSuscripcion)
    private readonly repo: Repository<PushSuscripcion>,
    @InjectRepository(Personal)
    private readonly personalRepo: Repository<Personal>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const publica = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privada = this.config.get<string>('VAPID_PRIVATE_KEY');
    // Contacto para los servicios de push: "mailto:alguien@dominio" o una URL https.
    const sujeto = this.config.get<string>('VAPID_SUBJECT');
    if (!publica || !privada || !sujeto) {
      this.logger.warn(
        'Push apagado: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT',
      );
      return;
    }
    webpush.setVapidDetails(sujeto, publica, privada);
    this.clavePublica = publica;
  }

  /** Para que el navegador se suscriba. Null = push apagado. */
  getClavePublica(): string | null {
    return this.clavePublica;
  }

  async suscribir(
    personalId: string,
    dto: SuscribirPushDto,
    userAgent?: string,
  ): Promise<void> {
    let host: string;
    try {
      host = new URL(dto.endpoint).hostname;
    } catch {
      throw new BadRequestException('Endpoint inválido');
    }
    if (!HOSTS_PUSH.some((re) => re.test(host))) {
      throw new BadRequestException('Servicio de push no reconocido');
    }
    // El mismo navegador puede re-suscribirse o cambiar de usuario: el
    // endpoint manda y queda a nombre de quien está ahora.
    await this.repo.upsert(
      {
        personalId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
      ['endpoint'],
    );
  }

  async desuscribir(personalId: string, endpoint: string): Promise<void> {
    await this.repo.delete({ personalId, endpoint });
  }

  /** A personas puntuales. */
  async enviarA(personalIds: string[], mensaje: MensajePush): Promise<void> {
    if (!this.clavePublica || !personalIds.length) return;
    const subs = await this.repo.find({
      where: { personalId: In(personalIds) },
    });
    await this.enviar(subs, mensaje);
  }

  /** A todo el personal activo con alguno de estos roles. */
  async enviarARoles(
    roles: RolPersonal[],
    mensaje: MensajePush,
  ): Promise<void> {
    if (!this.clavePublica) return;
    const personas = await this.personalRepo.find({
      where: { rol: In(roles), activo: true },
      select: { id: true },
    });
    await this.enviarA(
      personas.map((p) => p.id),
      mensaje,
    );
  }

  private async enviar(
    subs: PushSuscripcion[],
    mensaje: MensajePush,
  ): Promise<void> {
    const payload = JSON.stringify({
      titulo: mensaje.titulo,
      cuerpo: mensaje.cuerpo,
      enlace: mensaje.enlace ?? '/',
      tag: mensaje.tag,
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: 'high' },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.repo.delete({ id: s.id });
            return;
          }
          this.logger.warn(
            `Push falló (${status ?? 'sin status'}): ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
