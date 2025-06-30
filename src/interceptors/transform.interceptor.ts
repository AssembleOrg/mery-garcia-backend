// transform.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { map } from 'rxjs/operators';
  import { Observable } from 'rxjs';
  
  @Injectable()
  export class TransformInterceptor<T>
    implements NestInterceptor<T, { status: 'success'; data: T }>
  {
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<{ status: 'success'; data: T }> {
      return next.handle().pipe(
        map((data) => ({
          status: 'success',
          data,
        })),
      );
    }
  }
  