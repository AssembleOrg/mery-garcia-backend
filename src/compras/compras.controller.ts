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
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import {
  ComprasService,
  MAX_COMPROBANTE_BYTES,
  UsuarioCompras,
} from './compras.service';
import { CatalogosComprasService } from './catalogos-compras.service';
import {
  CambiarEstadoPedidoDto,
  CategoriaCompraDto,
  EntregarPedidoDto,
  FiltroPedidosCompraDto,
  GuardarPedidoCompraDto,
  ProveedorCompraDto,
} from './dto/compras.dto';

/** Admin y quien tiene el rol compras (sólo ve esta sección). */
const COMPRAS_ROLES = [RolPersonal.ADMIN, RolPersonal.COMPRAS];

/**
 * Compras: pedidos a proveedores (de la nota "falta comprar X" hasta que
 * llega y suma al stock), proveedores y categorías. Admin y rol compras (el guard
 * de roles mira cada método, por eso va @Roles en todos).
 */
@ApiTags('Compras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compras')
export class ComprasController {
  constructor(
    private readonly compras: ComprasService,
    private readonly catalogos: CatalogosComprasService,
  ) {}

  // ─── Pedidos ─────────────────────────────────────────────────

  @Roles(...COMPRAS_ROLES)
  @Get('pedidos')
  @ApiOperation({
    summary: 'Buscar pedidos (texto, estado, categoría, proveedor, fechas)',
  })
  listar(@Query() filtro: FiltroPedidosCompraDto) {
    return this.compras.listar(filtro);
  }

  @Roles(...COMPRAS_ROLES)
  @Get('pedidos/por-estado')
  @ApiOperation({ summary: 'Cuántos pedidos hay en cada estado' })
  porEstado() {
    return this.compras.contarPorEstado();
  }

  @Roles(...COMPRAS_ROLES)
  @Get('pedidos/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.obtener(id);
  }

  @Roles(...COMPRAS_ROLES)
  @Post('pedidos')
  @ApiOperation({ summary: 'Nuevo pedido (por defecto queda Anotado)' })
  crear(@Body() dto: GuardarPedidoCompraDto, @Req() req: Request) {
    return this.compras.crear(dto, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Put('pedidos/:id')
  @ApiOperation({
    summary: 'Editar un pedido (hasta 48 h después de comprado)',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarPedidoCompraDto,
    @Req() req: Request,
  ) {
    return this.compras.actualizar(id, dto, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Patch('pedidos/:id/estado')
  @ApiOperation({ summary: 'Pasar el pedido a otro estado' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoPedidoDto,
    @Req() req: Request,
  ) {
    return this.compras.cambiarEstado(id, dto.estado, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Post('pedidos/:id/entregar')
  @ApiOperation({ summary: 'Llegó: lo que afecta stock empieza a sumar' })
  entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntregarPedidoDto,
    @Req() req: Request,
  ) {
    return this.compras.entregar(id, dto, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Post('pedidos/:id/repetir')
  @ApiOperation({ summary: 'Pedido nuevo con lo mismo que este (sin precios)' })
  repetir(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.compras.repetir(id, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Delete('pedidos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.eliminar(id);
  }

  // ─── Comprobantes ────────────────────────────────────────────

  /** multipart: uno o más `comprobantes` (imagen o PDF, 10 MB c/u). */
  @Roles(...COMPRAS_ROLES)
  @Post('pedidos/:id/comprobantes')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('comprobantes', 5, {
      limits: { fileSize: MAX_COMPROBANTE_BYTES, files: 5 },
    }),
  )
  agregarComprobantes(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.compras.agregarComprobantes(id, archivos, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Get('comprobantes/:id')
  async verComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const c = await this.compras.comprobante(id);
    res.setHeader('Content-Type', c.mimeType);
    res.setHeader('Content-Length', String(c.datos.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(c.nombre)}`,
    );
    res.end(c.datos);
  }

  @Roles(...COMPRAS_ROLES)
  @Delete('comprobantes/:id')
  eliminarComprobante(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.compras.eliminarComprobante(id, usuario(req));
  }

  @Roles(...COMPRAS_ROLES)
  @Post('comprobantes/:id/costear')
  @ApiOperation({ summary: 'Volver a mandar el comprobante a Costear' })
  reenviarACostear(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.costearComprobante(id, true);
  }

  @Roles(...COMPRAS_ROLES)
  @Get('comprobantes/:id/costear')
  @ApiOperation({ summary: 'Cómo quedó el comprobante en Costear' })
  estadoEnCostear(@Param('id', ParseUUIDPipe) id: string) {
    return this.compras.costearComprobante(id, false);
  }

  // ─── Proveedores ─────────────────────────────────────────────

  @Roles(...COMPRAS_ROLES)
  @Get('proveedores')
  listarProveedores(@Query('buscar') buscar?: string) {
    return this.catalogos.listarProveedores(buscar);
  }

  @Roles(...COMPRAS_ROLES)
  @Post('proveedores')
  crearProveedor(@Body() dto: ProveedorCompraDto) {
    return this.catalogos.crearProveedor(dto);
  }

  @Roles(...COMPRAS_ROLES)
  @Put('proveedores/:id')
  actualizarProveedor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProveedorCompraDto,
  ) {
    return this.catalogos.actualizarProveedor(id, dto);
  }

  @Roles(...COMPRAS_ROLES)
  @Delete('proveedores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarProveedor(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogos.eliminarProveedor(id);
  }

  // ─── Categorías ──────────────────────────────────────────────

  @Roles(...COMPRAS_ROLES)
  @Get('categorias')
  listarCategorias() {
    return this.catalogos.listarCategorias();
  }

  @Roles(...COMPRAS_ROLES)
  @Post('categorias')
  crearCategoria(@Body() dto: CategoriaCompraDto) {
    return this.catalogos.crearCategoria(dto);
  }

  @Roles(...COMPRAS_ROLES)
  @Put('categorias/:id')
  actualizarCategoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoriaCompraDto,
  ) {
    return this.catalogos.actualizarCategoria(id, dto);
  }

  @Roles(...COMPRAS_ROLES)
  @Delete('categorias/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarCategoria(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogos.eliminarCategoria(id);
  }
}

function usuario(req: Request): UsuarioCompras {
  const u = req.user as { id?: string; nombre?: string } | undefined;
  return { id: u?.id ?? null, nombre: u?.nombre?.slice(0, 80) || 'Admin' };
}
