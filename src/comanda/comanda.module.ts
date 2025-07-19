import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComandaController } from './comanda.controller';
import { ComandaService } from './comanda.service';
import { Comanda } from './entities/Comanda.entity';
import { ItemComanda } from './entities/ItemComanda.entity';
import { TipoItem } from './entities/TipoItem.entity';
import { ProductoServicio } from './entities/productoServicio.entity';
import { UnidadNegocio } from './entities/unidadNegocio.entity';
import { Movimiento } from './entities/movimiento.entity';
import { Descuento } from './entities/descuento.entity';
import { TipoItemController } from './controllers/tipo-item.controller';
import { ProductoServicioController } from './controllers/producto-servicio.controller';
import { UnidadNegocioController } from './controllers/unidad-negocio.controller';
import { ItemComandaController } from './controllers/item-comanda.controller';
import { MovimientoController } from './controllers/movimiento.controller';
import { TipoItemService } from './services/tipo-item.service';
import { ProductoServicioService } from './services/producto-servicio.service';
import { UnidadNegocioService } from './services/unidad-negocio.service';
import { ItemComandaService } from './services/item-comanda.service';
import { MovimientoService } from './services/movimiento.service';
import { Cliente } from 'src/cliente/entities/Cliente.entity';
import { Personal } from 'src/personal/entities/Personal.entity';
import { MetodoPago } from 'src/cliente/entities/MetodoPago.entity';
import { Prepago } from 'src/personal/entities/Prepago.entity';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';
import { ConfiguracionSistema } from 'src/config/entities/ConfiguracionSistema.entity';
import { ConfigModule } from 'src/config/config.module';
import { PersonalModule } from 'src/personal/personal.module';
import { Trabajador } from 'src/personal/entities/Trabajador.entity';
import { PrepagoGuardado } from 'src/personal/entities/PrepagoGuardado.entity';
import { Egreso } from './entities/egreso.entity';
  
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comanda, 
      ItemComanda, 
      TipoItem,
      ProductoServicio,
      UnidadNegocio,
      Movimiento,
      Descuento,
      Egreso,
      Cliente, 
      Personal, 
      MetodoPago, 
      Prepago,
      ConfiguracionSistema,
      Trabajador,
      PrepagoGuardado,
    ]),
    AuditoriaModule,
    ConfigModule,
  ],
  controllers: [
    ComandaController,
    TipoItemController,
    ProductoServicioController,
    UnidadNegocioController,
    ItemComandaController,
    MovimientoController,
  ],
  providers: [
    ComandaService,
    TipoItemService,
    ProductoServicioService,
    UnidadNegocioService,
    ItemComandaService,
    MovimientoService,
  ],
  exports: [
    ComandaService,
    TipoItemService,
    ProductoServicioService,
    UnidadNegocioService,
    ItemComandaService,
    MovimientoService,
  ],
})
export class ComandaModule {}
