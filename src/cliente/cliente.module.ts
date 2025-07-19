import { Module } from '@nestjs/common';
import { ClienteService } from './cliente.service';
import { ClienteController } from './cliente.controller';
import { Cliente } from './entities/Cliente.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetodoPago } from './entities/MetodoPago.entity';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';

@Module({
  providers: [ClienteService],
  controllers: [ClienteController],
  imports: [TypeOrmModule.forFeature([Cliente, MetodoPago, PrepagoGuardado])],
})
export class ClienteModule {}
