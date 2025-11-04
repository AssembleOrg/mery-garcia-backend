import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as hpp from 'hpp';
import { TransformInterceptor } from './interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Habilitar trust proxy para que Express confíe en headers de proxy (nginx, load balancers)
  // Esto permite que request.ip capture correctamente la IP real del cliente
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // 1. Helmet: cabeceras HTTP seguras
  app.use(helmet());

  // 2. HPP: evita contaminación de parámetros
  app.use(hpp());

  // app.use(
  //   rateLimit({
  //     windowMs: 15 * 60 * 1000, // 15 minutos
  //     max: 100, // límite de peticiones
  //     standardHeaders: true,
  //     legacyHeaders: false,
  //   }),
  // );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Garcia 2025 API')
    .setDescription('Endpoints to manage Comandas, pagos, etc.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app as any, config);

  SwaggerModule.setup('docs', app as any, document, {
    swaggerOptions: { persistAuthorization: true },
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
