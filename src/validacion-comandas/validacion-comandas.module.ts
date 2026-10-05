import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoteValidacion } from './entities/loteValidacion.entity';
import { PaginaValidacion } from './entities/paginaValidacion.entity';
import { ValidacionComandasController } from './validacion-comandas.controller';
import { ValidacionComandasService } from './validacion-comandas.service';
import { LectorComandasService } from './lector-ia.service';

/**
 * Lee comandas en papel con IA y las compara contra las cargadas. Sólo informa:
 * no valida ni modifica comandas. Los datos del sistema se leen con SQL de sólo
 * lectura para no acoplarse a las entidades de comandas.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LoteValidacion, PaginaValidacion])],
  controllers: [ValidacionComandasController],
  providers: [ValidacionComandasService, LectorComandasService],
})
export class ValidacionComandasModule {}
