import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  Res,
  HttpStatus,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { CajaService } from './caja.service';
import { TransferirCajaDto } from './dto/transferir-caja.dto';
import { CrearMovimientoCajaDto } from './dto/movimiento-caja.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { Caja } from 'src/enums/Caja.enum';
import { TipoMovimiento } from 'src/enums/TipoMovimiento.enum';

@ApiTags('cajas')
@Controller('cajas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Get('balance/:caja')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiParam({ name: 'caja', enum: Caja, description: 'Caja a consultar' })
  @ApiOperation({ summary: 'Obtener balance de una caja' })
  @ApiResponse({ status: 200, description: 'Balance obtenido exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerBalanceCaja(@Param('caja') caja: Caja) {
    return this.cajaService.obtenerBalanceCaja(caja);
  }

  @Post('movimiento')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Crear un movimiento de caja (ingreso/egreso/ajuste)' })
  @ApiResponse({ status: 201, description: 'Movimiento creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en el movimiento' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async crearMovimiento(
    @Body() movimientoDto: CrearMovimientoCajaDto,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.cajaService.crearMovimiento(
      movimientoDto,
      req.user,
      ipAddress,
      userAgent,
    );
  }

  @Get('movimientos')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiQuery({ name: 'caja', enum: Caja, required: false, description: 'Filtrar por caja' })
  @ApiQuery({ name: 'tipoMovimiento', enum: TipoMovimiento, required: false, description: 'Filtrar por tipo de movimiento' })
  @ApiQuery({ name: 'fechaInicio', required: false, description: 'Fecha de inicio (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fechaFin', required: false, description: 'Fecha de fin (YYYY-MM-DD)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset para paginación', type: Number })
  @ApiOperation({ summary: 'Obtener movimientos de caja con filtros' })
  @ApiResponse({ status: 200, description: 'Movimientos obtenidos exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerMovimientos(
    @Query('caja') caja?: Caja,
    @Query('tipoMovimiento') tipoMovimiento?: TipoMovimiento,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const fechaInicioDate = fechaInicio ? new Date(fechaInicio) : undefined;
    const fechaFinDate = fechaFin ? new Date(fechaFin) : undefined;

    return this.cajaService.obtenerMovimientos(
      caja,
      tipoMovimiento,
      fechaInicioDate,
      fechaFinDate,
      limit,
      offset,
    );
  }

  @Post('transferir')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Transferir comandas entre cajas' })
  @ApiResponse({ status: 200, description: 'Transferencia exitosa' })
  @ApiResponse({ status: 400, description: 'Error en la transferencia' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async transferirEntreCajas(
    @Body() transferirDto: TransferirCajaDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.cajaService.transferirEntreCajas(
      transferirDto,
      req.user,
      ipAddress,
      userAgent,
    );

    // Configurar headers para descarga del PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transferencia-${transferirDto.cajaOrigen}-${transferirDto.cajaDestino}-${new Date().toISOString().split('T')[0]}.pdf"`,
    );

    // Enviar el PDF como respuesta
    res.status(HttpStatus.OK).send(result.pdfBuffer);
  }

  @Get('balance-todas')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Obtener balance de todas las cajas' })
  @ApiResponse({ status: 200, description: 'Balances obtenidos exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async obtenerBalanceTodasLasCajas() {
    const balances = await Promise.all([
      this.cajaService.obtenerBalanceCaja(Caja.CAJA_1),
      this.cajaService.obtenerBalanceCaja(Caja.CAJA_2),
    ]);

    return {
      caja1: balances[0],
      caja2: balances[1],
      totalGeneral: balances.reduce((sum, balance) => sum + balance.saldoReal, 0),
    };
  }
} 