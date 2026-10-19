import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoStock } from './entities/ProductoStock.entity';
import {
  SolicitudStock,
  SolicitudStockItem,
} from './entities/SolicitudStock.entity';
import { Trabajador } from '../personal/entities/Trabajador.entity';
import { Personal } from '../personal/entities/Personal.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PushModule } from '../push/push.module';
import { StockService } from './stock.service';
import { SolicitudesStockService } from './solicitudes-stock.service';
import { AccesosEmpleadoService } from './accesos-empleado.service';
import { StockController } from './stock.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductoStock,
      SolicitudStock,
      SolicitudStockItem,
      Trabajador,
      Personal,
    ]),
    WhatsappModule,
    PushModule,
  ],
  controllers: [StockController],
  providers: [StockService, SolicitudesStockService, AccesosEmpleadoService],
})
export class StockModule {}
