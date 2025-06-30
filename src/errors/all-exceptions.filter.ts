// all-exceptions.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
  
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
  
      // Determine status code
      const isHttp = exception instanceof HttpException;
      const status = isHttp
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
  
      // Determine message: use the HttpException’s response if available,
      // otherwise the exception.message, or a generic fallback.
      let message: string | string[];
      if (isHttp) {
        const res = exception.getResponse();
        message =
          typeof res === 'string'
            ? res
            : (res as any).message || exception.message;
      } else {
        message = (exception as any).message || 'Internal server error';
      }
  
      // If it’s not an HttpException, log it as an error
      if (!isHttp) {
        this.logger.error('Unhandled exception', (exception as any).stack);
      }
  
      // Send the formatted response
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
    }
  }
  