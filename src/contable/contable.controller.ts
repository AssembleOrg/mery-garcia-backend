import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { ContableService, UsuarioContable } from './contable.service';
import {
  ActualizarAcreedorDto,
  ActualizarDeudaDto,
  ActualizarPagoDto,
  CrearAcreedorDto,
  CrearDeudaDto,
  CrearPagoDto,
  FiltroDeudasDto,
  FiltroHistorialDto,
} from './dto/contable.dto';

/**
 * Deudas del negocio con personas y empresas, sus pagos y comprobantes.
 * Sólo admin: es el estado contable general. (RolesGuard lee @Roles del
 * handler, no de la clase: va en cada método.)
 */
@ApiTags('Contable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contable')
export class ContableController {
  constructor(private readonly contable: ContableService) {}

  @Roles(RolPersonal.ADMIN)
  @Get('resumen')
  @ApiOperation({
    summary: 'KPIs, evolución mensual, acreedores con saldo y vencimientos',
  })
  resumen(@Query('meses') meses?: string) {
    const n = Number(meses);
    return this.contable.resumen(
      Number.isInteger(n) && n >= 3 && n <= 36 ? n : 12,
    );
  }

  // ── Acreedores ──

  @Roles(RolPersonal.ADMIN)
  @Get('acreedores')
  listarAcreedores(@Query('buscar') buscar?: string) {
    return this.contable.listarAcreedores(buscar);
  }

  @Roles(RolPersonal.ADMIN)
  @Get('acreedores/:id')
  obtenerAcreedor(@Param('id', ParseUUIDPipe) id: string) {
    return this.contable.obtenerAcreedor(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Post('acreedores')
  crearAcreedor(@Body() dto: CrearAcreedorDto, @Req() req: Request) {
    return this.contable.crearAcreedor(dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Put('acreedores/:id')
  actualizarAcreedor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAcreedorDto,
    @Req() req: Request,
  ) {
    return this.contable.actualizarAcreedor(id, dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('acreedores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarAcreedor(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.contable.eliminarAcreedor(id, this.usuario(req));
  }

  // ── Deudas ──

  @Roles(RolPersonal.ADMIN)
  @Get('deudas')
  listarDeudas(@Query() filtro: FiltroDeudasDto) {
    return this.contable.listarDeudas(filtro);
  }

  @Roles(RolPersonal.ADMIN)
  @Get('deudas/:id')
  obtenerDeuda(@Param('id', ParseUUIDPipe) id: string) {
    return this.contable.obtenerDeuda(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Post('deudas')
  crearDeuda(@Body() dto: CrearDeudaDto, @Req() req: Request) {
    return this.contable.crearDeuda(dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Put('deudas/:id')
  @ApiOperation({
    summary:
      'Concepto/vencimiento/notas siempre; monto, moneda, acreedor y fecha sólo en 24 h',
  })
  actualizarDeuda(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarDeudaDto,
    @Req() req: Request,
  ) {
    return this.contable.actualizarDeuda(id, dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('deudas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sólo en las primeras 24 h y sin pagos' })
  eliminarDeuda(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.contable.eliminarDeuda(id, this.usuario(req));
  }

  // ── Pagos ──

  @Roles(RolPersonal.ADMIN)
  @Post('deudas/:id/pagos')
  registrarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearPagoDto,
    @Req() req: Request,
  ) {
    return this.contable.registrarPago(id, dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Put('pagos/:id')
  @ApiOperation({ summary: 'Sólo en las primeras 24 h' })
  actualizarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPagoDto,
    @Req() req: Request,
  ) {
    return this.contable.actualizarPago(id, dto, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('pagos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sólo en las primeras 24 h; el monto vuelve al saldo',
  })
  eliminarPago(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.contable.eliminarPago(id, this.usuario(req));
  }

  // ── Comprobantes ──

  /** multipart: uno o más `comprobantes` (imagen o PDF, 10 MB c/u). */
  @Roles(RolPersonal.ADMIN)
  @Post('pagos/:id/comprobantes')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('comprobantes', 5, {
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  agregarComprobantes(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.contable.agregarComprobantes(id, archivos, this.usuario(req));
  }

  /** Bytes del comprobante. Respuesta cruda (no pasa por el sobre {status, data}). */
  @Roles(RolPersonal.ADMIN)
  @Get('comprobantes/:id')
  async comprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const c = await this.contable.comprobante(id);
    res.setHeader('Content-Type', c.mimeType);
    res.setHeader('Content-Length', String(c.datos.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(c.nombre)}"`,
    );
    res.end(c.datos);
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('comprobantes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.contable.eliminarComprobante(id, this.usuario(req));
  }

  // ── Historial ──

  @Roles(RolPersonal.ADMIN)
  @Get('historial')
  historial(@Query() filtro: FiltroHistorialDto) {
    return this.contable.listarHistorial(filtro);
  }

  private usuario(req: Request): UsuarioContable {
    const u = req.user as { id: string; nombre: string };
    return { id: u.id, nombre: u.nombre };
  }
}
