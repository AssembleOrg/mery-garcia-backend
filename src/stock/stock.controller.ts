import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { StockService } from './stock.service';
import { SolicitudesStockService } from './solicitudes-stock.service';
import { AccesosEmpleadoService } from './accesos-empleado.service';
import { EstadoSolicitudStock } from './entities/SolicitudStock.entity';
import {
  ActualizarProductoStockDto,
  AsignarProductosDto,
  CrearProductosStockDto,
  CrearSolicitudStockDto,
  FiltroSolicitudesStockDto,
  GuardarAccesoEmpleadoDto,
  ResolverSolicitudStockDto,
} from './dto/stock.dto';

const EQUIPO = [RolPersonal.ADMIN, RolPersonal.ENCARGADO];

@ApiTags('Control de Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly solicitudes: SolicitudesStockService,
    private readonly accesos: AccesosEmpleadoService,
  ) {}

  @Get('productos')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Listar productos con los trabajadores asignados' })
  listarProductos() {
    return this.stockService.listarProductos();
  }

  @Post('productos')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Cargar uno o varios productos' })
  crearProductos(@Body() dto: CrearProductosStockDto) {
    return this.stockService.crearProductos(dto.nombres);
  }

  @Patch('productos/:id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Renombrar un producto' })
  actualizarProducto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoStockDto,
  ) {
    return this.stockService.actualizarProducto(id, dto.nombre);
  }

  @Delete('productos/:id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un producto y sus asignaciones' })
  eliminarProducto(@Param('id', ParseUUIDPipe) id: string) {
    return this.stockService.eliminarProducto(id);
  }

  @Put('trabajadores/:trabajadorId/productos')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Definir los productos que usa un trabajador' })
  asignarProductos(
    @Param('trabajadorId', ParseUUIDPipe) trabajadorId: string,
    @Body() dto: AsignarProductosDto,
  ) {
    return this.stockService.asignarProductos(trabajadorId, dto.productoIds);
  }

  // ─── Empleado: pedir productos ───────────────────────────────

  @Get('mis-productos')
  @Roles(RolPersonal.EMPLEADO)
  @ApiOperation({
    summary: 'Productos que puede pedir el empleado de la sesión',
  })
  misProductos(@Req() req: Request) {
    return this.solicitudes.misProductos(this.uid(req));
  }

  @Get('solicitudes/mias')
  @Roles(RolPersonal.EMPLEADO)
  @ApiOperation({ summary: 'Solicitudes del empleado de la sesión' })
  misSolicitudes(@Req() req: Request) {
    return this.solicitudes.misSolicitudes(this.uid(req));
  }

  @Post('solicitudes')
  @Roles(RolPersonal.EMPLEADO)
  @ApiOperation({ summary: 'Pedir productos (queda pendiente de aprobación)' })
  crearSolicitud(@Body() dto: CrearSolicitudStockDto, @Req() req: Request) {
    return this.solicitudes.crear(this.uid(req), dto);
  }

  @Post('solicitudes/:id/cancelar')
  @Roles(RolPersonal.EMPLEADO)
  @ApiOperation({ summary: 'Cancelar una solicitud propia que siga pendiente' })
  cancelarSolicitud(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.solicitudes.cancelar(this.uid(req), id);
  }

  // ─── Equipo: aprobar / rechazar ──────────────────────────────

  @Get('solicitudes')
  @Roles(...EQUIPO)
  @ApiOperation({
    summary: 'Solicitudes de todos (filtrables por estado y trabajador)',
  })
  listarSolicitudes(@Query() filtro: FiltroSolicitudesStockDto) {
    return this.solicitudes.listar(filtro);
  }

  @Get('solicitudes/pendientes/cantidad')
  @Roles(...EQUIPO)
  @ApiOperation({ summary: 'Cuántas solicitudes esperan respuesta' })
  async pendientes() {
    return { cantidad: await this.solicitudes.contarPendientes() };
  }

  @Post('solicitudes/:id/aprobar')
  @Roles(...EQUIPO)
  @ApiOperation({ summary: 'Aprobar una solicitud pendiente' })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverSolicitudStockDto,
    @Req() req: Request,
  ) {
    return this.solicitudes.resolver(
      this.uid(req),
      id,
      EstadoSolicitudStock.APROBADA,
      dto.respuesta,
    );
  }

  @Post('solicitudes/:id/rechazar')
  @Roles(...EQUIPO)
  @ApiOperation({ summary: 'Rechazar una solicitud pendiente' })
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverSolicitudStockDto,
    @Req() req: Request,
  ) {
    return this.solicitudes.resolver(
      this.uid(req),
      id,
      EstadoSolicitudStock.RECHAZADA,
      dto.respuesta,
    );
  }

  // ─── Accesos de empleados ────────────────────────────────────

  @Get('accesos')
  @Roles(...EQUIPO)
  @ApiOperation({ summary: 'Qué trabajadores tienen usuario para entrar' })
  listarAccesos() {
    return this.accesos.listar();
  }

  @Put('accesos/:trabajadorId')
  @Roles(...EQUIPO)
  @ApiOperation({
    summary: 'Crear o cambiar el usuario / contraseña de un trabajador',
  })
  guardarAcceso(
    @Param('trabajadorId', ParseUUIDPipe) trabajadorId: string,
    @Body() dto: GuardarAccesoEmpleadoDto,
  ) {
    return this.accesos.guardar(trabajadorId, dto.usuario, dto.password);
  }

  @Delete('accesos/:trabajadorId')
  @Roles(...EQUIPO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitarle el acceso a un trabajador' })
  quitarAcceso(@Param('trabajadorId', ParseUUIDPipe) trabajadorId: string) {
    return this.accesos.quitar(trabajadorId);
  }

  private uid(req: Request): string {
    return (req.user as { id: string }).id;
  }
}
