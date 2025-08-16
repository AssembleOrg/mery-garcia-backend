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
import { ClienteService } from './cliente.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { FiltrarClientesDto } from './dto/filtrar-clientes.dto';
import { Cliente } from './entities/Cliente.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClienteController {
    constructor(
        private readonly clienteService: ClienteService,
        private readonly auditoriaService: AuditoriaService,
    ) {}

    @Post()
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'CREATE', 
        entityType: 'Cliente',
        description: 'Cliente creado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Crear un nuevo cliente',
        description: 'Crea un nuevo cliente en el sistema',
    })
    @ApiResponse({
        status: 201,
        description: 'Cliente creado exitosamente',
        type: Cliente,
    })
    @ApiResponse({
        status: 400,
        description: 'Datos inválidos o CUIT duplicado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async crear(@Body() crearClienteDto: CrearClienteDto): Promise<Cliente> {
        const cliente = await this.clienteService.crear(crearClienteDto);
        
        return cliente;
    }

    @Get()
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener todos los clientes',
        description: 'Retorna todos los clientes sin paginación',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de clientes obtenida exitosamente',
        type: [Cliente],
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerTodos(): Promise<Cliente[]> {
        return await this.clienteService.obtenerTodos();
    }

    @Get('paginados')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener clientes con paginación',
        description: 'Retorna clientes paginados con filtros opcionales',
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
        description: 'Término de búsqueda',
        example: 'Juan',
    })
    @ApiQuery({
        name: 'nombre',
        required: false,
        type: String,
        description: 'Filtrar por nombre específico',
        example: 'Juan Pérez',
    })
    @ApiQuery({
        name: 'orderBy',
        required: false,
        type: String,
        description: 'Campo de ordenamiento',
        example: 'nombre',
        enum: ['nombre', 'fechaRegistro', 'createdAt', 'tieneSeñas'],
    })
    @ApiQuery({
        name: 'order',
        required: false,
        enum: ['ASC', 'DESC'],
        description: 'Orden de clasificación',
        example: 'ASC',
    })
    @ApiResponse({
        status: 200,
        description: 'Clientes paginados obtenidos exitosamente',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Cliente' },
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
    async obtenerConPaginacion(@Query() filtros: FiltrarClientesDto) {
        return await this.clienteService.obtenerConPaginacion(filtros);
    }

    @Get(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
    @ApiOperation({
        summary: 'Obtener cliente por ID',
        description: 'Retorna un cliente específico por su ID',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Cliente obtenido exitosamente',
        type: Cliente,
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerPorId(@Param('id', ParseUUIDPipe) id: string): Promise<Cliente> {
        return await this.clienteService.obtenerPorId(id);
    }

    @Put(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'UPDATE', 
        entityType: 'Cliente',
        description: 'Cliente actualizado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Actualizar cliente',
        description: 'Actualiza los datos de un cliente existente',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Cliente actualizado exitosamente',
        type: Cliente,
    })
    @ApiResponse({
        status: 400,
        description: 'Datos inválidos o CUIT duplicado',
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async actualizar(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() actualizarClienteDto: ActualizarClienteDto,
    ): Promise<Cliente> {
        const clienteActualizado = await this.clienteService.actualizar(id, actualizarClienteDto);

        
        return clienteActualizado;
    }

    @Delete(':id')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @HttpCode(HttpStatus.NO_CONTENT)
    @Audit({ 
        action: 'DELETE', 
        entityType: 'Cliente',
        description: 'Cliente eliminado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Eliminar cliente',
        description: 'Elimina un cliente (soft delete)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 204,
        description: 'Cliente eliminado exitosamente',
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.clienteService.eliminar(id);
        
    }

    @Post(':id/restaurar')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @Audit({ 
        action: 'UPDATE', 
        entityType: 'Cliente',
        description: 'Cliente restaurado en el sistema',
        includeRelations: true,
        sensitiveFields: ['password', 'token']
    })
    @ApiOperation({
        summary: 'Restaurar cliente eliminado',
        description: 'Restaura un cliente que fue eliminado (soft delete)',
    })
    @ApiParam({
        name: 'id',
        description: 'ID del cliente',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Cliente restaurado exitosamente',
        type: Cliente,
    })
    @ApiResponse({
        status: 400,
        description: 'El cliente no está eliminado',
    })
    @ApiResponse({
        status: 404,
        description: 'Cliente no encontrado',
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async restaurar(@Param('id', ParseUUIDPipe) id: string): Promise<Cliente> {
        const clienteRestaurado = await this.clienteService.restaurar(id);
        
        return clienteRestaurado;
    }

    @Get('estadisticas/resumen')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @ApiOperation({
        summary: 'Obtener estadísticas de clientes',
        description: 'Retorna estadísticas generales de clientes',
    })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas obtenidas exitosamente',
        schema: {
            type: 'object',
            properties: {
                totalClientes: { type: 'number' },
                clientesActivos: { type: 'number' },
                clientesEliminados: { type: 'number' },
                clientesConSeñas: { type: 'number' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'No autorizado',
    })
    async obtenerEstadisticas() {
        return await this.clienteService.obtenerEstadisticas();
    }

    @Get('estadisticas/senas-activas')
    @Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO)
    @ApiOperation({
        summary: 'Totales de señas activas',
        description: 'Suma de todas las señas activas agrupadas por moneda',
    })
    @ApiResponse({
        status: 200,
        description: 'Totales de señas activas',
        schema: {
            type: 'object',
            properties: { ars: { type: 'number' }, usd: { type: 'number' } },
        },
    })
    async obtenerTotalSeniasActivas(): Promise<{ ars: number; usd: number }> {
        return this.clienteService.obtenerTotalSeniasActivas();
    }
}
