import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappContacto } from './entities/WhatsappContacto.entity';
import { WhatsappConversacion } from './entities/WhatsappConversacion.entity';
import { WhatsappMensaje } from './entities/WhatsappMensaje.entity';
import { WhatsappAdjunto } from './entities/WhatsappAdjunto.entity';
import { WhatsappRespuesta } from './entities/WhatsappRespuesta.entity';
import { WhatsappConfig } from './entities/WhatsappConfig.entity';
import { Notificacion } from './entities/Notificacion.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { SidecarClient } from './sidecar.client';
import { ClasificadorService } from './clasificador.service';
import { WhatsappEventosService } from './whatsapp-eventos.service';
import { NotificacionesService } from './notificaciones.service';
import { ContactosService } from './contactos.service';
import { ConfigWhatsappService } from './config-whatsapp.service';
import { MensajesService } from './mensajes.service';
import { BotService } from './bot.service';
import { BandejaService } from './bandeja.service';
import { InactividadService } from './inactividad.service';
import { SidecarController } from './controllers/sidecar.controller';
import { BandejaController } from './controllers/bandeja.controller';
import { ConfigWhatsappController } from './controllers/config-whatsapp.controller';
import { NotificacionesController } from './controllers/notificaciones.controller';

/**
 * WhatsApp de Mery: bot de preguntas frecuentes con pase a una persona, la
 * bandeja para atender desde la web y las notificaciones dentro del sistema.
 *
 * El transporte (neonize) corre aparte, en `mery-whatsapp-sidecar`.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      WhatsappContacto,
      WhatsappConversacion,
      WhatsappMensaje,
      WhatsappAdjunto,
      WhatsappRespuesta,
      WhatsappConfig,
      Notificacion,
      Cliente,
    ]),
  ],
  controllers: [SidecarController, BandejaController, ConfigWhatsappController, NotificacionesController],
  providers: [
    SidecarClient,
    ClasificadorService,
    WhatsappEventosService,
    NotificacionesService,
    ContactosService,
    ConfigWhatsappService,
    MensajesService,
    BotService,
    BandejaService,
    InactividadService,
  ],
  exports: [WhatsappEventosService, NotificacionesService],
})
export class WhatsappModule {}
