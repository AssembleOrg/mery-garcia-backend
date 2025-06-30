import { Module } from '@nestjs/common';
import { ClienteService } from './cliente.service';
import { ClienteController } from './cliente.controller';
import { Cliente } from './entities/Cliente.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetodoPago } from './entities/MetodoPago.entity';

@Module({
  providers: [ClienteService],
  controllers: [ClienteController],
  imports: [TypeOrmModule.forFeature([Cliente, MetodoPago])],
})
export class ClienteModule {}
