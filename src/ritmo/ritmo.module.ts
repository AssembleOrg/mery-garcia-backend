import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RitmoService } from './ritmo.service';
import { RitmoController } from './ritmo.controller';
import { TurnosService } from './turnos/turnos.service';
import { KioscoController } from './kiosco/kiosco.controller';
import { KioscoService } from './kiosco/kiosco.service';

@Module({
  imports: [ConfigModule],
  controllers: [RitmoController, KioscoController],
  providers: [RitmoService, TurnosService, KioscoService],
  exports: [RitmoService, TurnosService, KioscoService],
})
export class RitmoModule {}
