import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoStock } from './entities/ProductoStock.entity';
import { Trabajador } from '../personal/entities/Trabajador.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductoStock, Trabajador])],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
