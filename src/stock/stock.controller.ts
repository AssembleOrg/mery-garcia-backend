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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { StockService } from './stock.service';
import {
  ActualizarProductoStockDto,
  AsignarProductosDto,
  CrearProductosStockDto,
} from './dto/stock.dto';

@ApiTags('Control de Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

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
}
