import { Module } from '@nestjs/common';
import { DatabaseCleanupService } from './services/database-cleanup.service';
import { DatabaseCleanupController } from './controllers/database-cleanup.controller';

@Module({
  controllers: [DatabaseCleanupController],
  providers: [DatabaseCleanupService],
  exports: [DatabaseCleanupService],
})
export class CommonModule {} 