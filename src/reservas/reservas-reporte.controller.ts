import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { ReporteReservadosService } from './reporte-reservados.service';
import { ReporteReservadosPdfService } from './reporte-reservados-pdf.service';
import { ServiciosBookingService } from './servicios-booking.service';

/**
 * Reporte "reservó un servicio, ¿se hizo ese u otro?". Solo admin y encargada.
 * Va aparte del receptor de booking (que no lleva JWT, lo autentica el secret).
 */
@Controller('reservas/reporte')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservasReporteController {
  constructor(
    private readonly reporte: ReporteReservadosService,
    private readonly pdf: ReporteReservadosPdfService,
    private readonly serviciosBooking: ServiciosBookingService,
  ) {}

  /** Lista de servicios de turnos, para elegir a qué apunta una seña manual. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Get('servicios')
  servicios() {
    return this.serviciosBooking.listar();
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Get('reservados')
  reservados(
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('soloDiscrepancias') soloDiscrepancias?: string,
  ) {
    return this.reporte.generar({
      fechaDesde,
      fechaHasta,
      soloDiscrepancias: soloDiscrepancias === 'true',
    });
  }

  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @Get('reservados/pdf')
  async reservadosPdf(
    @Res() res: Response,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('soloDiscrepancias') soloDiscrepancias?: string,
  ) {
    const reporte = await this.reporte.generar({
      fechaDesde,
      fechaHasta,
      soloDiscrepancias: soloDiscrepancias === 'true',
    });
    const pdf = await this.pdf.generar(reporte);
    const nombre = `reservas-vs-realizado_${reporte.fechaDesde}_a_${reporte.fechaHasta}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.end(Buffer.from(pdf));
  }
}
