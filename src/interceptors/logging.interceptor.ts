import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { LOG_ACTION_KEY, LogActionMetadata } from '../decorators/log-action.decorator';
import { TipoAccion } from '../enums/TipoAccion.enum';
import { ModuloSistema } from '../enums/ModuloSistema.enum';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, params, user } = request;
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = request.ip || request.connection.remoteAddress || (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || 'unknown';
    const userAgent = request.get('User-Agent') || 'unknown';

    // Get metadata from decorator
    const logMetadata = this.reflector.get<LogActionMetadata>(
      LOG_ACTION_KEY,
      context.getHandler(),
    );

    // If no metadata, try to determine from URL and method
    const action = logMetadata?.action || this.getActionFromMethod(method);
    const entityType = logMetadata?.entityType || this.getEntityTypeFromUrl(url);
    const entityId = params?.id || body?.id;
    const userId = (user as any)?.sub || (user as any)?.id;

    if (!action || !entityType || !userId) {
      return next.handle();
    }

    // Capturar datos anteriores para UPDATE y DELETE
    let datosAnteriores: any = null;
    if (action === 'UPDATE' || action === 'DELETE') {
      // Para UPDATE y DELETE, podríamos capturar datos anteriores
      // Esto requeriría una consulta adicional antes de la operación
      // Por ahora, usaremos los datos del body como "anteriores"
      datosAnteriores = action === 'UPDATE' ? body : null;
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // console.log(`Logging ${action} action for ${entityType} by user ${userId}`);
          
          // Map action to TipoAccion
          const tipoAccion = this.mapActionToTipoAccion(action, entityType);
          const modulo = this.mapEntityTypeToModulo(entityType);
          
          if (tipoAccion && modulo) {
            let descripcion = logMetadata?.description;
            
            // Generate description based on action and response
            if (!descripcion) {
              descripcion = this.generateDescription(action, entityType, response, body);
            }

            // Preparar datos para auditoría
            const datosNuevos = this.prepareEntityData(response, entityType);
            const observaciones = this.generateObservations(action, entityType, body, response);

            await this.auditoriaService.registrar({
              tipoAccion,
              modulo,
              entidadId: entityId || response?.id || 'unknown',
              descripcion,
              datosAnteriores,
              datosNuevos,
              observaciones,
              ipAddress,
              userAgent,
            });
          }
        } catch (error) {
          // Don't let logging errors break the main flow
          console.error('Logging error:', error);
        }
      }),
    );
  }

  private getActionFromMethod(method: string): 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | null {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PATCH':
      case 'PUT':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return null;
    }
  }

  private getEntityTypeFromUrl(url: string): string | null {
    if (url.includes('/comandas')) return 'Comanda';
    if (url.includes('/clientes')) return 'Cliente';
    if (url.includes('/trabajadores')) return 'Trabajador';
    if (url.includes('/prepagos-guardados')) return 'PrepagoGuardado';
    if (url.includes('/items-comanda')) return 'ItemComanda';
    if (url.includes('/auth/login')) return 'Auth';
    if (url.includes('/auth/register')) return 'Auth';
    if (url.includes('/dolar')) return 'Dolar';
    if (url.includes('/database')) return 'Database';
    return null;
  }

  private mapActionToTipoAccion(action: string, entityType: string): TipoAccion | null {
    const actionMap: Record<string, Record<string, TipoAccion>> = {
      'CREATE': {
        'Comanda': TipoAccion.COMANDA_CREADA,
        'Cliente': TipoAccion.CLIENTE_CREADO,
        'Trabajador': TipoAccion.TRABAJADOR_CREADO,
        'PrepagoGuardado': TipoAccion.PREPAGO_GUARDADO_CREADO,
        'ItemComanda': TipoAccion.ITEM_COMANDA_CREADO,
        'Auth': TipoAccion.USUARIO_CREADO,
      },
      'UPDATE': {
        'Comanda': TipoAccion.COMANDA_MODIFICADA,
        'Cliente': TipoAccion.CLIENTE_MODIFICADO,
        'Trabajador': TipoAccion.TRABAJADOR_MODIFICADO,
        'PrepagoGuardado': TipoAccion.PREPAGO_GUARDADO_MODIFICADO,
        'ItemComanda': TipoAccion.ITEM_COMANDA_MODIFICADO,
        'Dolar': TipoAccion.DOLAR_ACTUALIZADO,
      },
      'DELETE': {
        'Comanda': TipoAccion.COMANDA_ELIMINADA,
        'Cliente': TipoAccion.CLIENTE_ELIMINADO,
        'Trabajador': TipoAccion.TRABAJADOR_ELIMINADO,
        'PrepagoGuardado': TipoAccion.PREPAGO_GUARDADO_ELIMINADO,
        'ItemComanda': TipoAccion.ITEM_COMANDA_ELIMINADO,
      },
      'LOGIN': {
        'Auth': TipoAccion.USUARIO_LOGIN,
      },
    };

    return actionMap[action]?.[entityType] || null;
  }

  private mapEntityTypeToModulo(entityType: string): ModuloSistema | null {
    const moduloMap: Record<string, ModuloSistema> = {
      'Comanda': ModuloSistema.COMANDA,
      'Cliente': ModuloSistema.CLIENTE,
      'Trabajador': ModuloSistema.TRABAJADOR,
      'PrepagoGuardado': ModuloSistema.PREPAGO_GUARDADO,
      'ItemComanda': ModuloSistema.ITEM_COMANDA,
      'Auth': ModuloSistema.AUTH,
      'Dolar': ModuloSistema.DOLAR,
      'Database': ModuloSistema.DATABASE_CLEANUP,
    };

    return moduloMap[entityType] || null;
  }

  private generateDescription(action: string, entityType: string, response: any, body: any): string {
    switch (action) {
      case 'CREATE':
        if (entityType === 'Comanda') {
          return `Comanda creada: ${response?.numero || 'N/A'}`;
        }
        if (entityType === 'Cliente') {
          return `Cliente creado: ${response?.nombre || 'N/A'}`;
        }
        if (entityType === 'Trabajador') {
          return `Trabajador creado: ${response?.nombre || 'N/A'}`;
        }
        if (entityType === 'Auth') {
          return `Usuario registrado: ${response?.email || 'N/A'}`;
        }
        return `${entityType} creado`;
      
      case 'UPDATE':
        if (entityType === 'Comanda') {
          return `Comanda actualizada: ${response?.numero || 'N/A'}`;
        }
        if (entityType === 'Cliente') {
          return `Cliente actualizado: ${response?.nombre || 'N/A'}`;
        }
        if (entityType === 'Trabajador') {
          return `Trabajador actualizado: ${response?.nombre || 'N/A'}`;
        }
        if (entityType === 'Dolar') {
          return `Cotización del dólar actualizada: Compra ${body?.compra}, Venta ${body?.venta}`;
        }
        return `${entityType} actualizado`;
      
      case 'DELETE':
        return `${entityType} eliminado`;
      
      case 'LOGIN':
        return `Usuario inició sesión: ${response?.user?.email || 'N/A'}`;
      
      default:
        return `Acción ${action} en ${entityType}`;
    }
  }

  private prepareEntityData(response: any, entityType: string): any {
    if (!response) return null;

    // Limpiar datos sensibles y metadatos innecesarios
    const cleanData = { ...response };
    
    // Remover campos sensibles
    delete cleanData.password;
    delete cleanData.token;
    delete cleanData.refreshToken;
    
    // Remover metadatos de TypeORM si existen
    delete cleanData.__entity;
    delete cleanData.__hasId;
    
    // Para arrays, limpiar cada elemento
    if (Array.isArray(cleanData)) {
      return cleanData.map(item => this.prepareEntityData(item, entityType));
    }

    return cleanData;
  }

  private generateObservations(action: string, entityType: string, body: any, response: any): string {
    const observations: string[] = [];

    // Agregar información sobre la acción
    observations.push(`Acción: ${action}`);
    observations.push(`Entidad: ${entityType}`);

    // Agregar información específica según el tipo de entidad
    if (entityType === 'Comanda') {
      if (response?.numero) observations.push(`Número: ${response.numero}`);
      if (response?.tipoDeComanda) observations.push(`Tipo: ${response.tipoDeComanda}`);
      if (response?.estadoDeComanda) observations.push(`Estado: ${response.estadoDeComanda}`);
    }

    if (entityType === 'Cliente') {
      if (response?.nombre) observations.push(`Nombre: ${response.nombre}`);
      if (response?.cuit) observations.push(`CUIT: ${response.cuit}`);
      if (response?.dni) observations.push(`DNI: ${response.dni}`);
    }

    if (entityType === 'Trabajador') {
      if (response?.nombre) observations.push(`Nombre: ${response.nombre}`);
      if (response?.activo !== undefined) observations.push(`Activo: ${response.activo}`);
    }

    if (entityType === 'Dolar') {
      if (body?.compra) observations.push(`Compra: ${body.compra}`);
      if (body?.venta) observations.push(`Venta: ${body.venta}`);
    }

    return observations.join(' | ');
  }
} 