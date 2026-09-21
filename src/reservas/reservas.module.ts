import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { Cliente } from '../cliente/entities/Cliente.entity';
import { Comanda } from '../comanda/entities/Comanda.entity';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { ReporteReservadosService } from './reporte-reservados.service';
import { ReporteReservadosPdfService } from './reporte-reservados-pdf.service';
import { ServiciosBookingService } from './servicios-booking.service';
import { ReservasReporteController } from './reservas-reporte.controller';

/**
 * Ingesta de reservas pagadas de booking → seña en este sistema. La seña no
 * lleva profesional: entra para cualquier reserva; el reporte la atribuye por
 * el servicio de la comanda donde se usa.
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([PrepagoGuardado, Cliente, Comanda])],
  controllers: [ReservasController, ReservasReporteController],
  providers: [ReservasService, ReporteReservadosService, ReporteReservadosPdfService, ServiciosBookingService],
  exports: [ReservasService],
})
export class ReservasModule {}
