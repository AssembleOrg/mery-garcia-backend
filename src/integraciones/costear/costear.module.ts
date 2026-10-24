import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CostearController } from './costear.controller';
import { CajaTotalesService } from './caja-totales.service';
import { MovimientosDiaService } from './movimientos-dia.service';

/** Lo que Costear lee de este sistema (totales de caja por medio de pago y el detalle de cada día). */
@Module({
  imports: [ConfigModule],
  controllers: [CostearController],
  providers: [CajaTotalesService, MovimientosDiaService],
})
export class CostearModule {}
