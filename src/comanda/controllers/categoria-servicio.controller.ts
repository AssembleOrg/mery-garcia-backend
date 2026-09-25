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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { CategoriaServicioService } from '../services/categoria-servicio.service';
import {
  ActualizarCategoriaServicioDto,
  CrearCategoriaServicioDto,
} from '../dto/categoria-servicio.dto';
import { CategoriaServicio } from '../entities/categoriaServicio.entity';

@ApiTags('Categorías de servicio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categorias-servicio')
export class CategoriaServicioController {
  constructor(private readonly service: CategoriaServicioService) {}

  @Get()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  @ApiOperation({ summary: 'Listar categorías de servicio con sus servicios' })
  obtenerTodas(): Promise<CategoriaServicio[]> {
    return this.service.obtenerTodas();
  }

  @Get(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
  obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<CategoriaServicio> {
    return this.service.obtenerPorId(id);
  }

  @Post()
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Crear categoría (opcionalmente con sus servicios)' })
  crear(@Body() dto: CrearCategoriaServicioDto): Promise<CategoriaServicio> {
    return this.service.crear(dto);
  }

  @Put(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @ApiOperation({ summary: 'Editar categoría; servicioIds reemplaza la lista de servicios' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCategoriaServicioDto,
  ): Promise<CategoriaServicio> {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar categoría (sus servicios quedan sin categoría)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.eliminar(id);
  }
}
