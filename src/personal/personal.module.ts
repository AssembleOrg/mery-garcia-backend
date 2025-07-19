import { Module } from '@nestjs/common';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';
import { TrabajadorController } from './controllers/trabajador.controller';
import { TrabajadorService } from './services/trabajador.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from './entities/Personal.entity';
import { Prepago } from './entities/Prepago.entity';
import { PrepagoGuardado } from './entities/PrepagoGuardado.entity';
import { Trabajador } from './entities/Trabajador.entity';

@Module({
  controllers: [PersonalController, TrabajadorController],
  providers: [PersonalService, TrabajadorService],
  imports: [TypeOrmModule.forFeature([Personal, Prepago, PrepagoGuardado, Trabajador])],
  exports: [PersonalService, TrabajadorService],
})
export class PersonalModule {}
