import { Controller, Post, Get, UseGuards, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { DatabaseCleanupService } from '../services/database-cleanup.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { CleanTablesDto } from '../dto/clean-tables.dto';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@Controller('database')
export class DatabaseCleanupController {
  constructor(
    private readonly databaseCleanupService: DatabaseCleanupService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post('clean')
  @HttpCode(HttpStatus.OK)
  @Roles(RolPersonal.ADMIN) // Solo administradores pueden limpiar la BD
  @Audit({ 
    action: 'DELETE', 
    entityType: 'Database',
    description: 'Limpieza completa de la base de datos ejecutada',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  async cleanDatabase() {
    const resultado = await this.databaseCleanupService.cleanAllTables();
    

    
    return resultado;
  }

  @Get('info')
  @HttpCode(HttpStatus.OK)
  @Roles(RolPersonal.ADMIN) // Solo administradores pueden ver la información
  async getDatabaseInfo() {
    return await this.databaseCleanupService.getTableInfo();
  }

    @Post('clean-specific')
  @HttpCode(HttpStatus.OK)
    @Roles(RolPersonal.ADMIN) // Solo administradores pueden limpiar tablas específicas
  @Audit({ 
    action: 'DELETE', 
    entityType: 'Database',
    description: 'Limpieza de tablas específicas ejecutada',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  async cleanSpecificTables(@Body() body: CleanTablesDto) {
    const resultado = await this.databaseCleanupService.cleanSpecificTables(body.tables);
    

    
    return resultado;
  }

  @Post('drop-all')
  @HttpCode(HttpStatus.OK)
    @Roles(RolPersonal.ADMIN) // Solo administradores pueden eliminar tablas
  @Audit({ 
    action: 'DELETE', 
    entityType: 'Database',
    description: 'Eliminación de todas las tablas ejecutada',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  async dropAllTables() {
    const resultado = await this.databaseCleanupService.dropAllTables();
    

    
    return resultado;
  }

  @Post('drop-all-complete')
  @HttpCode(HttpStatus.OK)
  //   @Roles(RolPersonal.ADMIN) // Solo administradores pueden eliminar todas las tablas
  @Audit({ 
    action: 'DELETE', 
    entityType: 'Database',
    description: 'Eliminación completa de todas las tablas ejecutada',
    includeRelations: true,
    sensitiveFields: ['password', 'token']
  })
  async dropAllTablesComplete() {
    const resultado = await this.databaseCleanupService.dropAllTablesWithoutExceptions();
    
    return resultado;
  }
} 