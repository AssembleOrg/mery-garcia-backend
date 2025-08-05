import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  entityType: string;
  description?: string;
  captureBeforeData?: boolean; // Para capturar datos antes de UPDATE/DELETE
  sensitiveFields?: string[]; // Campos sensibles a excluir
  includeRelations?: boolean; // Incluir relaciones en los datos
}

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata); 