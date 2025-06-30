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
import { TipoComandaService } from '../services/tipo-comanda.service';
import { CrearTipoComandaDto, ActualizarTipoComandaDto } from '../dto/tipo-comanda.dto';
import { TipoComanda } from '../entities/TipoComanda.entity';

@ApiTags('Tipos de Comanda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tipos-comanda')
export class TipoComandaController {
  constructor(private readonly tipoComandaService: TipoComandaService) {}

  @Post()
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo tipo de comanda' })
  @ApiResponse({
    status: 201,
    description: 'Tipo de comanda creado exitosamente',
    type: TipoComanda,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  async crear(@Body() crearTipoComandaDto: CrearTipoComandaDto): Promise<TipoComanda> {
    return this.tipoComandaService.crear(crearTipoComandaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los tipos de comanda activos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de comanda obtenida exitosamente',
    type: [TipoComanda],
  })
  async findAll(): Promise<TipoComanda[]> {
    return this.tipoComandaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tipo de comanda por ID' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de comanda encontrado exitosamente',
    type: TipoComanda,
  })
  @ApiResponse({ status: 404, description: 'Tipo de comanda no encontrado' })
  async findOne(@Param('id') id: string): Promise<TipoComanda> {
    return this.tipoComandaService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Actualizar un tipo de comanda' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de comanda actualizado exitosamente',
    type: TipoComanda,
  })
  @ApiResponse({ status: 404, description: 'Tipo de comanda no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  async actualizar(
    @Param('id') id: string,
    @Body() actualizarTipoComandaDto: ActualizarTipoComandaDto,
  ): Promise<TipoComanda> {
    return this.tipoComandaService.actualizar(id, actualizarTipoComandaDto);
  }

  @Delete(':id')
  @Roles(RolPersonal.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar lógicamente un tipo de comanda' })
  @ApiResponse({ status: 204, description: 'Tipo de comanda eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Tipo de comanda no encontrado' })
  @ApiResponse({ status: 409, description: 'No se puede eliminar porque está en uso' })
  async eliminar(@Param('id') id: string): Promise<void> {
    return this.tipoComandaService.eliminar(id);
  }

  @Post(':id/restaurar')
  @Roles(RolPersonal.ADMIN)
  @ApiOperation({ summary: 'Restaurar un tipo de comanda eliminado' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de comanda restaurado exitosamente',
    type: TipoComanda,
  })
  @ApiResponse({ status: 404, description: 'Tipo de comanda no encontrado' })
  @ApiResponse({ status: 409, description: 'El tipo de comanda no está eliminado' })
  async restaurar(@Param('id') id: string): Promise<TipoComanda> {
    return this.tipoComandaService.restaurar(id);
  }
} 