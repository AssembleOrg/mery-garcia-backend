import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CostearController } from './costear.controller';
import { CajaTotalesService } from './caja-totales.service';

/** Lo que Costear lee de este sistema (totales de caja por medio de pago). */
@Module({
  imports: [ConfigModule],
  controllers: [CostearController],
  providers: [CajaTotalesService],
})
export class CostearModule {}
