import { Module } from '@nestjs/common';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from './entities/Personal.entity';
import { Prepago } from './entities/Prepago.entity';
import { PrepagoGuardado } from './entities/PrepagoGuardado.entity';
import { Comision } from './entities/Comision.entity';

@Module({
  controllers: [PersonalController],
  providers: [PersonalService],
  imports: [TypeOrmModule.forFeature([Personal, Prepago, PrepagoGuardado, Comision])],
})
export class PersonalModule {}
