import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Acreedor } from './entities/acreedor.entity';
import { Deuda } from './entities/deuda.entity';
import { PagoDeuda } from './entities/pagoDeuda.entity';
import { ComprobantePago } from './entities/comprobantePago.entity';
import { MovimientoContable } from './entities/movimientoContable.entity';
import { Adelanto } from './entities/adelanto.entity';
import { ContableController } from './contable.controller';
import { ContableService } from './contable.service';

/** Deudas del negocio (a personas o empresas), pagos, comprobantes e historial. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Acreedor,
      Deuda,
      PagoDeuda,
      ComprobantePago,
      MovimientoContable,
      Adelanto,
    ]),
  ],
  controllers: [ContableController],
  providers: [ContableService],
})
export class ContableModule {}
