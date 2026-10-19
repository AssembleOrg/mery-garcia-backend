import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSuscripcion } from './entities/PushSuscripcion.entity';
import { Personal } from '../personal/entities/Personal.entity';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PushSuscripcion, Personal]),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
