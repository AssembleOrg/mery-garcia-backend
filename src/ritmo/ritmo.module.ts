import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RitmoService } from './ritmo.service';
import { RitmoController } from './ritmo.controller';
import { TurnosService } from './turnos/turnos.service';
import { PatronService } from './turnos/patron.service';
import { HorariosService } from './turnos/horarios.service';
import { HorariosController } from './turnos/horarios.controller';
import { PatronTurno } from './turnos/entities/PatronTurno.entity';
import { KioscoController } from './kiosco/kiosco.controller';
import { KioscoService } from './kiosco/kiosco.service';
import { RitmoWebhooksController } from './webhooks/webhooks.controller';
import { RitmoWebhooksService } from './webhooks/webhooks.service';
import { RitmoWebhookEvento } from './webhooks/entities/RitmoWebhookEvento.entity';
import { EventosService } from './eventos/eventos.service';
import { ReportesController } from './reportes/reportes.controller';
import { AsistenciaPdfService } from './reportes/asistencia-pdf.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RitmoWebhookEvento, PatronTurno]),
  ],
  controllers: [
    RitmoController,
    HorariosController,
    KioscoController,
    RitmoWebhooksController,
    ReportesController,
  ],
  providers: [
    RitmoService,
    TurnosService,
    PatronService,
    HorariosService,
    KioscoService,
    RitmoWebhooksService,
    EventosService,
    AsistenciaPdfService,
  ],
  exports: [RitmoService, TurnosService, PatronService, KioscoService, EventosService],
})
export class RitmoModule {}
