// transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, { status: 'success'; data: T } | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ status: 'success'; data: T } | T> {
    // Un endpoint SSE emite muchos mensajes por una misma conexión y cada uno
    // tiene que llegar con la forma { type, data } que espera el navegador.
    // Envolverlos como a una respuesta común rompería el nombre del evento.
    const esSse = Reflect.getMetadata(SSE_METADATA, context.getHandler());
    if (esSse) return next.handle();

    return next.handle().pipe(
      map((data) => ({
        status: 'success' as const,
        data,
      })),
    );
  }
}
