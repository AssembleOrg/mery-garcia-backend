// src/app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

import supabaseConfig from './config/supabase.config';
import serverConfig from './config/server.config';
import postgresDbConfig from './config/postgresDb.config';
import digitalOceanConfig from './config/digitalOcean.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PersonalModule } from './personal/personal.module';
import { ClienteModule } from './cliente/cliente.module';
import { ComandaModule } from './comanda/comanda.module';
import { AuthModule } from './auth/auth.module';
import { CajaModule } from './caja/caja.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ConfigModule as SistemaConfigModule } from './config/config.module';

@Module({
  imports: [
    // Configuración global de .env
    ConfigModule.forRoot({
      isGlobal: true,
      load: [supabaseConfig, serverConfig, postgresDbConfig, digitalOceanConfig],
    }),

    // TypeORM dinámico usando sólo POSTGRES_URL y un solo glob de entidades
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // Aquí le pasas la URL completa:
        url: config.get<string>('postgres.url'),

        // Descubre todas las entidades .entity.ts/.entity.js
        // entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],

        // Si usas migraciones:
        migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],

        synchronize: false,
        logging: false,
        autoLoadEntities: true,
      }),
    }),

    // Módulos de dominio
    PersonalModule,
    ComandaModule,
    ClienteModule,
    AuthModule,
    CajaModule,
    AuditoriaModule,
    SistemaConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService, ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) { }

  onModuleInit() {
    console.log('AppModule initialized — DB URL:', this.config.get('postgres.url'));
  }
}
