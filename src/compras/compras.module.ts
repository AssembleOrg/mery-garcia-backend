import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ComprobanteCompra,
  PedidoCompra,
  PedidoCompraItem,
} from './entities/PedidoCompra.entity';
import { ProveedorCompra } from './entities/ProveedorCompra.entity';
import { CategoriaCompra } from './entities/CategoriaCompra.entity';
import { ProductoStock } from '../stock/entities/ProductoStock.entity';
import { ConfiguracionSistema } from '../config/entities/ConfiguracionSistema.entity';
import { ComprasService } from './compras.service';
import { CatalogosComprasService } from './catalogos-compras.service';
import { CostearComprobantesService } from './costear-comprobantes.service';
import { ComprasController } from './compras.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PedidoCompra,
      PedidoCompraItem,
      ComprobanteCompra,
      ProveedorCompra,
      CategoriaCompra,
      ProductoStock,
      ConfiguracionSistema,
    ]),
  ],
  controllers: [ComprasController],
  providers: [
    ComprasService,
    CatalogosComprasService,
    CostearComprobantesService,
  ],
})
export class ComprasModule {}
