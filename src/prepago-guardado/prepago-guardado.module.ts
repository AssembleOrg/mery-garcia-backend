import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrepagoGuardadoController } from './prepago-guardado.controller';
import { PrepagoGuardadoService } from './prepago-guardado.service';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrepagoGuardado, Cliente]),
    AuditoriaModule,
  ],
  controllers: [PrepagoGuardadoController],
  providers: [PrepagoGuardadoService],
  exports: [PrepagoGuardadoService],
})
export class PrepagoGuardadoModule {} 