import { SetMetadata } from '@nestjs/common';

export const LOG_ACTION_KEY = 'logAction';

export interface LogActionMetadata {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  entityType: string;
  description?: string;
}

export const LogAction = (metadata: LogActionMetadata) => SetMetadata(LOG_ACTION_KEY, metadata); 