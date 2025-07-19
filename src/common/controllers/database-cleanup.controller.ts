import { Controller, Post, Get, UseGuards, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { DatabaseCleanupService } from '../services/database-cleanup.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { RolPersonal } from '../../enums/RolPersonal.enum';
import { CleanTablesDto } from '../dto/clean-tables.dto';

@Controller('database')
export class DatabaseCleanupController {
  constructor(private readonly databaseCleanupService: DatabaseCleanupService) {}

  @Post('clean')
  @HttpCode(HttpStatus.OK)
//   @Roles(RolPersonal.ADMIN) // Solo administradores pueden limpiar la BD
  async cleanDatabase() {
    return await this.databaseCleanupService.cleanAllTables();
  }

  @Get('info')
  @HttpCode(HttpStatus.OK)
//   @Roles(RolPersonal.ADMIN) // Solo administradores pueden ver la información
  async getDatabaseInfo() {
    return await this.databaseCleanupService.getTableInfo();
  }

    @Post('clean-specific')
  @HttpCode(HttpStatus.OK)
  //   @Roles(RolPersonal.ADMIN) // Solo administradores pueden limpiar tablas específicas
  async cleanSpecificTables(@Body() body: CleanTablesDto) {
    return await this.databaseCleanupService.cleanSpecificTables(body.tables);
  }

  @Post('drop-all')
  @HttpCode(HttpStatus.OK)
  //   @Roles(RolPersonal.ADMIN) // Solo administradores pueden eliminar tablas
  async dropAllTables() {
    return await this.databaseCleanupService.dropAllTables();
  }

  @Post('drop-all-complete')
  @HttpCode(HttpStatus.OK)
  //   @Roles(RolPersonal.ADMIN) // Solo administradores pueden eliminar todas las tablas
  async dropAllTablesComplete() {
    return await this.databaseCleanupService.dropAllTablesWithoutExceptions();
  }
} 