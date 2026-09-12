import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RitmoService } from './ritmo.service';
import { RitmoController } from './ritmo.controller';
import { TurnosService } from './turnos/turnos.service';

@Module({
  imports: [ConfigModule],
  controllers: [RitmoController],
  providers: [RitmoService, TurnosService],
  exports: [RitmoService, TurnosService],
})
export class RitmoModule {}
