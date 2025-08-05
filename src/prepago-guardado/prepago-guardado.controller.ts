import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { PrepagoGuardadoService } from './prepago-guardado.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { CrearPrepagoGuardadoDto } from './dto/crear-prepago-guardado.dto';
import { ActualizarPrepagoGuardadoDto } from './dto/actualizar-prepago-guardado.dto';
import { FiltrarPrepagosGuardadosDto } from './dto/filtrar-prepagos-guardados.dto';
import { CambiarEstadoPrepagoDto } from './dto/cambiar-estado-prepago.dto';
import { PrepagoGuardado } from '../personal/entities/PrepagoGuardado.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Prepagos Guardados')
@ApiBearerAuth()
@Controller('prepagos-guardados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrepagoGuardadoController {
    constructor(
        private readonly prepagoGuardadoService: PrepagoGuardadoService,
        private readonly auditoriaService: AuditoriaService,
    ) {}

    @Post()
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'CREATE', 
        entityType: 'PrepagoGuardado',
        description: 'Prepago guardado creado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Crear un nuevo prepago guardado',
        description: 'Crea un nuevo prepago guardado para un cliente',
    })
    @ApiResponse({
        status: 201,
        description: 'Prepago guardado creado exitosamente',
        type: PrepagoGuardado,
    })
    @ApiResponse({
        status: 400,
        description: 'Datos inválidos o cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async crear(@Body() crearPrepagoGuardadoDto: CrearPrepagoGuardadoDto): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoService.crear(crearPrepagoGuardadoDto);
        
        return prepagoGuardado;
    }

    @Get()
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener todos los prepagos guardados',
        description: 'Retorna todos los prepagos guardados sin paginación',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de prepagos guardados obtenida exitosamente',
        type: [PrepagoGuardado],
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerTodos(): Promise<PrepagoGuardado[]> {
        return await this.prepagoGuardadoService.obtenerTodos();
    }

    @Get('paginados')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener prepagos guardados con paginación',
        description: 'Retorna prepagos guardados paginados con filtros opcionales',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Número de página',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Elementos por página',
        example: 10,
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: 'Término de búsqueda en observaciones',
        example: 'tatuaje',
    })
    @ApiQuery({
        name: 'moneda',
        required: false,
        enum: ['pesos', 'dolares'],
        description: 'Filtrar por moneda',
    })
    @ApiQuery({
        name: 'estado',
        required: false,
        enum: ['ACTIVO', 'UTILIZADO', 'VENCIDO'],
        description: 'Filtrar por estado',
    })
    @ApiQuery({
        name: 'clienteId',
        required: false,
        type: String,
        description: 'Filtrar por ID de cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiQuery({
        name: 'orderBy',
        required: false,
        type: String,
        description: 'Campo de ordenamiento',
        example: 'fechaCreacion',
    })
    @ApiQuery({
        name: 'order',
        required: false,
        enum: ['ASC', 'DESC'],
        description: 'Orden de clasificación',
        example: 'DESC',
    })
    @ApiResponse({
        status: 200,
        description: 'Prepagos guardados paginados obtenidos exitosamente',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/PrepagoGuardado' },
                },
                meta: {
                    type: 'object',
                    properties: {
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        total: { type: 'number' },
                        totalPages: { type: 'number' },
                        hasNextPage: { type: 'boolean' },
                        hasPreviousPage: { type: 'boolean' },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerConPaginacion(@Query() filtros: FiltrarPrepagosGuardadosDto) {
        return await this.prepagoGuardadoService.obtenerConPaginacion(filtros);
    }

    @Get(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener prepago guardado por ID',
        description: 'Retorna un prepago guardado específico por su ID',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del prepago guardado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Prepago guardado obtenido exitosamente',
        type: PrepagoGuardado,
    })
    @ApiResponse({
        status: 404,
        description: 'Prepago guardado no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<PrepagoGuardado> {
        return await this.prepagoGuardadoService.obtenerPorId(id);
    }

    @Put(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'UPDATE', 
        entityType: 'PrepagoGuardado',
        description: 'Prepago guardado actualizado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Actualizar prepago guardado',
        description: 'Actualiza los datos de un prepago guardado existente',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del prepago guardado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Prepago guardado actualizado exitosamente',
        type: PrepagoGuardado,
    })
    @ApiResponse({
        status: 400,
        description: 'Datos inválidos o cliente no encontrado',
    })
    @ApiResponse({
        status: 404,
        description: 'Prepago guardado no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async actualizar(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() actualizarPrepagoGuardadoDto: ActualizarPrepagoGuardadoDto,
    ): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoService.actualizar(id, actualizarPrepagoGuardadoDto);
        
        return prepagoGuardado;
    }

    @Put(':id/estado')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'UPDATE', 
        entityType: 'PrepagoGuardado',
        description: 'Estado del prepago guardado cambiado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Cambiar estado del prepago guardado',
        description: 'Cambia el estado de un prepago guardado (ACTIVO, UTILIZADO, VENCIDO)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del prepago guardado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Estado del prepago guardado cambiado exitosamente',
        type: PrepagoGuardado,
    })
    @ApiResponse({
        status: 400,
        description: 'Estado inválido o prepago no puede cambiar a ese estado',
    })
    @ApiResponse({
        status: 404,
        description: 'Prepago guardado no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async cambiarEstado(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() cambiarEstadoPrepagoDto: CambiarEstadoPrepagoDto,
    ): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoService.cambiarEstado(id, cambiarEstadoPrepagoDto);
        
        return prepagoGuardado;
    }

    @Delete(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @HttpCode(HttpStatus.NO_CONTENT)
    @Audit({ 
        action: 'DELETE', 
        entityType: 'PrepagoGuardado',
        description: 'Prepago guardado eliminado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Eliminar prepago guardado',
        description: 'Elimina un prepago guardado (soft delete)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del prepago guardado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 204,
        description: 'Prepago guardado eliminado exitosamente',
    })
    @ApiResponse({
        status: 404,
        description: 'Prepago guardado no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.prepagoGuardadoService.eliminar(id);
        
    }

    @Post(':id/restaurar')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'UPDATE', 
        entityType: 'PrepagoGuardado',
        description: 'Prepago guardado restaurado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Restaurar prepago guardado eliminado',
        description: 'Restaura un prepago guardado que fue eliminado (soft delete)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del prepago guardado',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Prepago guardado restaurado exitosamente',
        type: PrepagoGuardado,
    })
    @ApiResponse({
        status: 400,
        description: 'El prepago guardado no está eliminado',
    })
    @ApiResponse({
        status: 404,
        description: 'Prepago guardado no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<PrepagoGuardado> {
        const prepagoGuardado = await this.prepagoGuardadoService.restaurar(id);
        
        
        return prepagoGuardado;
    }

    @Get('cliente/:clienteId')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener prepagos guardados por cliente',
        description: 'Retorna todos los prepagos guardados de un cliente específico',
    })
    @ApiParam({
        name: 'clienteId',
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Prepagos guardados del cliente obtenidos exitosamente',
        type: [PrepagoGuardado],
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerPorCliente(@Param('clienteId', ParseUUIDPipe) clienteId: string): Promise<PrepagoGuardado[]> {
        return await this.prepagoGuardadoService.obtenerPorCliente(clienteId);
    }

    @Get('estadisticas/resumen')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @ApiOperation({
        summary: 'Obtener estadísticas de prepagos guardados',
        description: 'Retorna estadísticas generales de prepagos guardados',
    })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas obtenidas exitosamente',
        schema: {
            type: 'object',
            properties: {
                totalPrepagos: { type: 'number' },
                prepagosActivos: { type: 'number' },
                prepagosUtilizados: { type: 'number' },
                prepagosVencidos: { type: 'number' },
                montosActivos: {
                    type: 'object',
                    properties: {
                        pesos: { type: 'number' },
                        dolares: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerEstadisticas() {
        return await this.prepagoGuardadoService.obtenerEstadisticas();
    }
} 