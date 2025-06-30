import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { Caja as CajaEntity } from './entities/Caja.entity';
import { MovimientoCaja } from './entities/MovimientoCaja.entity';
import { Comanda } from 'src/comanda/entities/Comanda.entity';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CajaEntity, MovimientoCaja, Comanda]),
    AuditoriaModule,
  ],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {} 