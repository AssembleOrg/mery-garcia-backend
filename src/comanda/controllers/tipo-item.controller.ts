import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { TipoItemService } from '../services/tipo-item.service';
import { CrearTipoItemDto, ActualizarTipoItemDto } from '../dto/tipo-item.dto';
import { TipoItem } from '../entities/TipoItem.entity';

@ApiTags('Tipos de Item')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tipos-item')
export class TipoItemController {
  constructor(private readonly tipoItemService: TipoItemService) {}

  @Post()
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo tipo de item' })
  @ApiResponse({
    status: 201,
    description: 'Tipo de item creado exitosamente',
    type: TipoItem,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  async crear(@Body() crearTipoItemDto: CrearTipoItemDto): Promise<TipoItem> {
    return this.tipoItemService.crear(crearTipoItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los tipos de item activos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de item obtenida exitosamente',
    type: [TipoItem],
  })
  async findAll(): Promise<TipoItem[]> {
    return this.tipoItemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tipo de item por ID' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de item encontrado exitosamente',
    type: TipoItem,
  })
  @ApiResponse({ status: 404, description: 'Tipo de item no encontrado' })
  async findOne(@Param('id') id: string): Promise<TipoItem> {
    return this.tipoItemService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Actualizar un tipo de item' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de item actualizado exitosamente',
    type: TipoItem,
  })
  @ApiResponse({ status: 404, description: 'Tipo de item no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  async actualizar(
    @Param('id') id: string,
    @Body() actualizarTipoItemDto: ActualizarTipoItemDto,
  ): Promise<TipoItem> {
    return this.tipoItemService.actualizar(id, actualizarTipoItemDto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente un tipo de item' })
  @ApiResponse({ status: 204, description: 'Tipo de item eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Tipo de item no encontrado' })
  @ApiResponse({ status: 409, description: 'No se puede eliminar porque está en uso' })
  async eliminar(@Param('id') id: string): Promise<void> {
    return this.tipoItemService.eliminar(id);
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Restaurar un tipo de item eliminado' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de item restaurado exitosamente',
    type: TipoItem,
  })
  @ApiResponse({ status: 404, description: 'Tipo de item no encontrado' })
  @ApiResponse({ status: 409, description: 'El tipo de item no está eliminado' })
  async restaurar(@Param('id') id: string): Promise<TipoItem> {
    return this.tipoItemService.restaurar(id);
  }
} 