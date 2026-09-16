import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RitmoService } from '../ritmo.service';
import { AsistenciaPdfService } from './asistencia-pdf.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';

/**
 * Reportes de presentismo. Los datos los da Ritmo; el PDF se arma acá, que es
 * donde vive el formato con el que Mery los quiere ver.
 */
@Controller('ritmo/reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(
    private readonly ritmo: RitmoService,
    private readonly pdf: AsistenciaPdfService,
  ) {}

  /** Los datos crudos, para pintar la tabla en pantalla. */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get('asistencia')
  asistencia(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('personas') personas?: string,
  ) {
    return this.ritmo.asistencia({
      desde,
      hasta,
      personas: personas ? personas.split(',').filter(Boolean) : undefined,
    });
  }

  /**
   * El mismo reporte como PDF descargable.
   *
   * Se responde con `res` directamente y no con un return: lo que se manda es
   * un archivo, no el envelope JSON que el interceptor le pone a todo lo demás.
   */
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.PRESENTISMO)
  @Get('asistencia.pdf')
  @Header('Content-Type', 'application/pdf')
  async asistenciaPdf(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
    @Query('personas') personas?: string,
  ): Promise<void> {
    const datos = await this.ritmo.asistencia({
      desde,
      hasta,
      personas: personas ? personas.split(',').filter(Boolean) : undefined,
    });

    const archivo = await this.pdf.generar(datos);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="asistencia-${datos.from}-a-${datos.to}.pdf"`,
    );
    res.end(Buffer.from(archivo));
  }
}
