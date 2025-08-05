import { Module } from '@nestjs/common';
import { DatabaseCleanupService } from './services/database-cleanup.service';
import { DatabaseCleanupController } from './controllers/database-cleanup.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [AuditoriaModule, ConfigModule],
  controllers: [DatabaseCleanupController],
  providers: [DatabaseCleanupService],
  exports: [DatabaseCleanupService, ConfigModule],
})
export class CommonModule {} 