import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { ConfigWhatsappService } from './config-whatsapp.service';
import { MensajesService } from './mensajes.service';
import { BotService } from './bot.service';
import { AutorMensaje, EstadoConversacion, MotivoCierre } from './whatsapp.enums';

/** Charla atendida sin mensajes durante 1 h → "¿seguís ahí?"; 1 h más → se cierra. */
const AVISO_MS = 60 * 60_000;
const CIERRE_TRAS_AVISO_MS = 60 * 60_000;
/** Charla del bot sin mensajes durante 12 h → se cierra en silencio. */
const CIERRE_BOT_MS = 12 * 60 * 60_000;
/** Charla esperando a una persona sin que nadie la tome → vuelve al bot y queda marcada. */
const ESPERA_MAXIMA_MS = 60 * 60_000;

/**
 * Cierre por inactividad y vencimiento de la espera.
 *
 * Una charla ESPERANDO que nadie toma en una hora vuelve sola al bot y queda
 * marcada como vencida: así la clienta no queda hablándole a nadie y el
 * equipo tiene la lista de lo que se le pasó. El reloj corre de corrido,
 * también fuera del horario de atención.
 */
@Injectable()
export class InactividadService {
  private readonly logger = new Logger(InactividadService.name);
  private corriendo = false;

  constructor(
    @InjectRepository(WhatsappConversacion)
    private readonly conversaciones: Repository<WhatsappConversacion>,
    private readonly config: ConfigWhatsappService,
    private readonly mensajes: MensajesService,
    private readonly bot: BotService,
  ) {}

  @Cron('* * * * *')
  async revisar(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await this.vencerEsperando();
      await this.avisarAtendidas();
      await this.cerrarAtendidas();
      await this.cerrarDelBot();
    } catch (error) {
      this.logger.error(`Error en el cierre por inactividad: ${(error as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  private async vencerEsperando(): Promise<void> {
    const limite = new Date(Date.now() - ESPERA_MAXIMA_MS);
    const filas = await this.conversaciones.find({
      where: { estado: EstadoConversacion.ESPERANDO, esperandoDesde: LessThan(limite) },
      order: { esperandoDesde: 'ASC' },
      take: 50,
    });
    for (const conv of filas) {
      try {
        await this.bot.vencerEspera(conv);
      } catch (error) {
        this.logger.error(`No se pudo vencer la espera de ${conv.id}: ${(error as Error).message}`);
      }
    }
  }

  private async avisarAtendidas(): Promise<void> {
    const limite = new Date(Date.now() - AVISO_MS);
    const filas = await this.conversaciones.find({
      where: { estado: EstadoConversacion.ATENDIDA, avisoInactividadAt: IsNull(), ultimoMensajeAt: LessThan(limite) },
      take: 50,
    });
    if (filas.length === 0) return;
    const cfg = await this.config.obtener();
    for (const conv of filas) {
      await this.conversaciones.update({ id: conv.id }, { avisoInactividadAt: new Date() });
      await this.mensajes.enviarTexto(conv, cfg.mensajes.avisoInactividad, AutorMensaje.BOT);
      // enviarTexto mueve ultimoMensajeAt: el cierre se mide desde el aviso.
    }
  }

  private async cerrarAtendidas(): Promise<void> {
    const limite = new Date(Date.now() - CIERRE_TRAS_AVISO_MS);
    const filas = await this.conversaciones.find({
      where: { estado: EstadoConversacion.ATENDIDA, avisoInactividadAt: Not(IsNull()) },
      take: 50,
    });
    const vencidas = filas.filter((c) => c.avisoInactividadAt && c.avisoInactividadAt < limite);
    if (vencidas.length === 0) return;
    const cfg = await this.config.obtener();
    for (const conv of vencidas) {
      await this.mensajes.enviarTexto(conv, cfg.mensajes.despedida, AutorMensaje.BOT);
      await this.cerrar(conv);
    }
  }

  private async cerrarDelBot(): Promise<void> {
    const limite = new Date(Date.now() - CIERRE_BOT_MS);
    const filas = await this.conversaciones.find({
      where: { estado: EstadoConversacion.BOT, ultimoMensajeAt: LessThan(limite) },
      take: 100,
    });
    for (const conv of filas) await this.cerrar(conv);
  }

  private async cerrar(conv: WhatsappConversacion): Promise<void> {
    await this.conversaciones.update(
      { id: conv.id },
      {
        estado: EstadoConversacion.CERRADA,
        cerradaAt: new Date(),
        motivoCierre: MotivoCierre.INACTIVIDAD,
        esperandoOpcionMenu: false,
      },
    );
    this.logger.log(`Charla ${conv.id} cerrada por inactividad`);
    await this.bot.publicarConversacion(conv);
  }
}
