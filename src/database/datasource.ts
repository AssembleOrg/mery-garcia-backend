// src/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export default new DataSource({
  type: 'postgres',

  // Leemos sólo el URL completo:
  url: process.env.POSTGRES_URL,

  // En lugar de listar cada carpeta, un solo glob que abarque TODO tu proyecto:
  entities: [
    path.join(__dirname, '..', '**', '*.entity.{ts,js}'),
  ],

  // Mismas migraciones
  migrations: [
    path.join(__dirname, 'migrations', '*.{ts,js}'),
  ],

  // No sincronizamos en producción
  synchronize: false,
  logging: false,

  // Si necesitas SSL en producción:
  // extra: {
  //   ssl: {
  //     rejectUnauthorized: false,
  //   },
  // },
});
