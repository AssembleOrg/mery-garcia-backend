import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfiguracionSistema } from './entities/ConfiguracionSistema.entity';
import { CotizacionDolar } from './entities/CotizacionDolar.entity';
import { DolarService } from './services/dolar.service';
import { DolarController } from './controllers/dolar.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfiguracionSistema, CotizacionDolar]),
    ScheduleModule.forRoot(),
  ],
  controllers: [DolarController],
  providers: [DolarService],
  exports: [DolarService],
})
export class ConfigModule {} 