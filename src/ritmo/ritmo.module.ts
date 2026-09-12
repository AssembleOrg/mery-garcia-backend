import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RitmoService } from './ritmo.service';
import { RitmoController } from './ritmo.controller';
import { TurnosService } from './turnos/turnos.service';
import { KioscoController } from './kiosco/kiosco.controller';
import { KioscoService } from './kiosco/kiosco.service';
import { RitmoWebhooksController } from './webhooks/webhooks.controller';
import { RitmoWebhooksService } from './webhooks/webhooks.service';
import { RitmoWebhookEvento } from './webhooks/entities/RitmoWebhookEvento.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([RitmoWebhookEvento])],
  controllers: [RitmoController, KioscoController, RitmoWebhooksController],
  providers: [RitmoService, TurnosService, KioscoService, RitmoWebhooksService],
  exports: [RitmoService, TurnosService, KioscoService],
})
export class RitmoModule {}
