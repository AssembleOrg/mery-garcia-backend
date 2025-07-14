import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComandaController } from './comanda.controller';
import { ComandaService } from './comanda.service';
import { Comanda } from './entities/Comanda.entity';
import { ItemComanda } from './entities/ItemComanda.entity';
import { TipoComanda } from './entities/TipoComanda.entity';
import { TipoItem } from './entities/TipoItem.entity';
import { TipoComandaController } from './controllers/tipo-comanda.controller';
import { TipoItemController } from './controllers/tipo-item.controller';
import { TipoComandaService } from './services/tipo-comanda.service';
import { TipoItemService } from './services/tipo-item.service';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { MetodoPago } from 'src/cliente/entities/MetodoPago.entity';
import { Prepago } from 'src/personal/entities/Prepago.entity';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ConfiguracionSistema } from 'src/config/entities/ConfiguracionSistema.entity';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comanda, 
      ItemComanda, 
      TipoComanda,
      TipoItem,
      Cliente, 
      Personal, 
      MetodoPago, 
      Prepago,
      ConfiguracionSistema,
    ]),
    AuditoriaModule,
    ConfigModule,
  ],
  controllers: [
    ComandaController,
    TipoComandaController,
    TipoItemController,
  ],
  providers: [
    ComandaService,
    TipoComandaService,
    TipoItemService,
  ],
  exports: [
    ComandaService,
    TipoComandaService,
    TipoItemService,
  ],
})
export class ComandaModule {}
