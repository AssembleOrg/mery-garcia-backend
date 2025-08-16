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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
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
    
    // Mejorar la captura del usuario
    let userId = null;
    if (user) {
      userId = (user as any)?.sub || (user as any)?.id || (user as any)?.userId;
    }
    
    // Si no hay userId en el user object, intentar obtenerlo del request
    if (!userId) {
      userId = (request as any)?.user?.sub || (request as any)?.user?.id || (request as any)?.user?.userId;
    }

    if (!action || !entityType) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // console.log(`Auditing ${action} action for ${entityType} by user ${userId}`);
          
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

            // Para UPDATE, usar body como datos anteriores
            const datosAnteriores = action === 'UPDATE' ? this.prepareEntityData(body, entityType) : null;

            // console.log('Audit Data:', {
            //   tipoAccion,
            //   modulo,
            //   entidadId: entityId || response?.id || 'unknown',
            //   descripcion,
            //   datosAnteriores: datosAnteriores ? 'Present' : 'None',
            //   datosNuevos: datosNuevos ? 'Present' : 'None',
            //   observaciones,
            //   ipAddress,
            //   userAgent,
            //   userId
            // });

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
              usuario: userId ? { id: userId } as any : undefined,
            });
          }
        } catch (error) {
          // Don't let logging errors break the main flow
          console.error('Audit error:', error);
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
    if (url.includes('/productos-servicios')) return 'ProductoServicio';
    if (url.includes('/producto-servicio')) return 'ProductoServicio';
    if (url.includes('/movimientos')) return 'Movimiento';
    if (url.includes('/tipo-items')) return 'TipoItem';
    if (url.includes('/unidades-negocio')) return 'UnidadNegocio';
    if (url.includes('/personal')) return 'Personal';
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
        'Personal': TipoAccion.PERSONAL_CREADO,
        'Movimiento': TipoAccion.MOVIMIENTO_CREADO,
        'ProductoServicio': TipoAccion.PRODUCTO_SERVICIO_CREADO,
        'TipoItem': TipoAccion.TIPO_ITEM_CREADO,
        'UnidadNegocio': TipoAccion.UNIDAD_NEGOCIO_CREADA,
      },
      'UPDATE': {
        'Comanda': TipoAccion.COMANDA_MODIFICADA,
        'Cliente': TipoAccion.CLIENTE_MODIFICADO,
        'Trabajador': TipoAccion.TRABAJADOR_MODIFICADO,
        'PrepagoGuardado': TipoAccion.PREPAGO_GUARDADO_MODIFICADO,
        'ItemComanda': TipoAccion.ITEM_COMANDA_MODIFICADO,
        'Dolar': TipoAccion.DOLAR_ACTUALIZADO,
        'Personal': TipoAccion.PERSONAL_MODIFICADO,
        'Movimiento': TipoAccion.MOVIMIENTO_MODIFICADO,
        'ProductoServicio': TipoAccion.PRODUCTO_SERVICIO_MODIFICADO,
        'TipoItem': TipoAccion.TIPO_ITEM_MODIFICADO,
        'UnidadNegocio': TipoAccion.UNIDAD_NEGOCIO_MODIFICADA,
      },
      'DELETE': {
        'Comanda': TipoAccion.COMANDA_ELIMINADA,
        'Cliente': TipoAccion.CLIENTE_ELIMINADO,
        'Trabajador': TipoAccion.TRABAJADOR_ELIMINADO,
        'PrepagoGuardado': TipoAccion.PREPAGO_GUARDADO_ELIMINADO,
        'ItemComanda': TipoAccion.ITEM_COMANDA_ELIMINADO,
        'Personal': TipoAccion.PERSONAL_ELIMINADO,
        'Movimiento': TipoAccion.MOVIMIENTO_ELIMINADO,
        'ProductoServicio': TipoAccion.PRODUCTO_SERVICIO_ELIMINADO,
        'TipoItem': TipoAccion.TIPO_ITEM_ELIMINADO,
        'UnidadNegocio': TipoAccion.UNIDAD_NEGOCIO_ELIMINADA,
        'Database': TipoAccion.DATABASE_CLEANUP,
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
      'Personal': ModuloSistema.PERSONAL,
      'Caja': ModuloSistema.CAJA,
      'Prepago': ModuloSistema.PREPAGO,
      'Comision': ModuloSistema.COMISION,
      'Sistema': ModuloSistema.SISTEMA,
      'Auditoria': ModuloSistema.AUDITORIA,
      'Config': ModuloSistema.CONFIG,
      'Movimiento': ModuloSistema.MOVIMIENTO,
      'ProductoServicio': ModuloSistema.PRODUCTO_SERVICIO,
      'TipoItem': ModuloSistema.TIPO_ITEM,
      'UnidadNegocio': ModuloSistema.UNIDAD_NEGOCIO,
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
    delete cleanData.hash;
    delete cleanData.salt;
    
    // Remover metadatos de TypeORM si existen
    delete cleanData.__entity;
    delete cleanData.__hasId;
    delete cleanData.__metadata;
    
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
      if (response?.caja) observations.push(`Caja: ${response.caja}`);
      if (response?.precioDolar) observations.push(`Precio USD: ${response.precioDolar}`);
      if (response?.precioPesos) observations.push(`Precio ARS: ${response.precioPesos}`);
    }

    if (entityType === 'Cliente') {
      if (response?.nombre) observations.push(`Nombre: ${response.nombre}`);
      if (response?.cuit) observations.push(`CUIT: ${response.cuit}`);
      if (response?.dni) observations.push(`DNI: ${response.dni}`);
      if (response?.telefono) observations.push(`Teléfono: ${response.telefono}`);
      if (response?.email) observations.push(`Email: ${response.email}`);
    }

    if (entityType === 'Trabajador') {
      if (response?.nombre) observations.push(`Nombre: ${response.nombre}`);
      if (response?.activo !== undefined) observations.push(`Activo: ${response.activo}`);
      if (response?.especialidad) observations.push(`Especialidad: ${response.especialidad}`);
    }

    if (entityType === 'PrepagoGuardado') {
      if (response?.monto) observations.push(`Monto: ${response.monto}`);
      if (response?.moneda) observations.push(`Moneda: ${response.moneda}`);
      if (response?.estado) observations.push(`Estado: ${response.estado}`);
    }

    if (entityType === 'Dolar') {
      if (body?.compra) observations.push(`Compra: ${body.compra}`);
      if (body?.venta) observations.push(`Venta: ${body.venta}`);
      if (body?.casa) observations.push(`Casa: ${body.casa}`);
    }

    return observations.join(' | ');
  }
} 