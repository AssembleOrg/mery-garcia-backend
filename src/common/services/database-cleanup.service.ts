import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseCleanupService {
  private readonly logger = new Logger(DatabaseCleanupService.name);

  constructor(private dataSource: DataSource) {}

  async cleanAllTables(): Promise<{ message: string; tablesCleaned: string[] }> {
    const queryRunner = this.dataSource.createQueryRunner(); 
    const tablesCleaned: string[] = [];

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Lista de tablas que NO queremos limpiar (relacionadas con auth y configuración)
      const excludedTables = [
        'users', // Si tienes tabla de usuarios
        'auth', // Si tienes tabla de auth
        'sessions', // Si tienes tabla de sesiones
        'refresh_tokens', // Si tienes tabla de refresh tokens
        'configuracion_sistema', // Configuración del sistema
        'personal',
        'clientes',
        'productos_servicios',
        'unidades_negocio',
        'trabajadores',
      ];

      // Obtener todas las tablas de la base de datos
      const placeholders = excludedTables.map((_, index) => `$${index + 1}`).join(',');
      const tables = await queryRunner.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (${placeholders})
        ORDER BY tablename
      `, excludedTables);

      this.logger.log(`Encontradas ${tables.length} tablas para limpiar`);

      // Limpiar cada tabla
      for (const table of tables) {
        const tableName = table.tablename;
        
        try {
          // Deshabilitar foreign key checks temporalmente
          await queryRunner.query('SET session_replication_role = replica;');
          
          // Limpiar la tabla
          await queryRunner.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
          
          // Rehabilitar foreign key checks
          await queryRunner.query('SET session_replication_role = DEFAULT;');
          
          tablesCleaned.push(tableName);
          this.logger.log(`Tabla ${tableName} limpiada exitosamente`);
        } catch (error) {
          this.logger.error(`Error limpiando tabla ${tableName}:`, error.message);
          throw error;
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: `Base de datos limpiada exitosamente. ${tablesCleaned.length} tablas fueron limpiadas.`,
        tablesCleaned
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error durante la limpieza de la base de datos:', error);
      throw new Error(`Error limpiando la base de datos: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async getTableInfo(): Promise<{ tableName: string; rowCount: number }[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      
      // Obtener información de todas las tablas
      const tables = await queryRunner.query(`
        SELECT 
          tablename,
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = tablename) as row_count
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

      const tableInfo: { tableName: string; rowCount: number }[] = [];
      
      for (const table of tables) {
        const tableName = table.tablename;
        try {
          const result = await queryRunner.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const rowCount = parseInt(result[0].count);
          tableInfo.push({ tableName, rowCount });
        } catch (error) {
          this.logger.warn(`No se pudo obtener información de la tabla ${tableName}: ${error.message}`);
        }
      }

      return tableInfo;

    } catch (error) {
      this.logger.error('Error obteniendo información de tablas:', error);
      throw new Error(`Error obteniendo información de tablas: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async cleanSpecificTables(tablesToClean: string[]): Promise<{ message: string; tablesCleaned: string[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const tablesCleaned: string[] = [];

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      this.logger.log(`Limpiando ${tablesToClean.length} tablas específicas`);

      // Limpiar cada tabla especificada
      for (const tableName of tablesToClean) {
        try {
          // Verificar que la tabla existe
          const tableExists = await queryRunner.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )
          `, [tableName]);

          if (!tableExists[0].exists) {
            this.logger.warn(`Tabla ${tableName} no existe`);
            continue;
          }

          // Deshabilitar foreign key checks temporalmente
          await queryRunner.query('SET session_replication_role = replica;');
          
          // Limpiar la tabla
          await queryRunner.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
          
          // Rehabilitar foreign key checks
          await queryRunner.query('SET session_replication_role = DEFAULT;');
          
          tablesCleaned.push(tableName);
          this.logger.log(`Tabla ${tableName} limpiada exitosamente`);
        } catch (error) {
          this.logger.error(`Error limpiando tabla ${tableName}:`, error.message);
          throw error;
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: `Tablas específicas limpiadas exitosamente. ${tablesCleaned.length} tablas fueron limpiadas.`,
        tablesCleaned
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error durante la limpieza de tablas específicas:', error);
      throw new Error(`Error limpiando tablas específicas: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async dropAllTables(): Promise<{ message: string; tablesDropped: string[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const tablesDropped: string[] = [];

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Lista de tablas que NO queremos eliminar (relacionadas con auth y configuración)
      const excludedTables = [
        'users', // Si tienes tabla de usuarios
        'auth', // Si tienes tabla de auth
        'sessions', // Si tienes tabla de sesiones
        'refresh_tokens', // Si tienes tabla de refresh tokens
        'configuracion_sistema', // Configuración del sistema
        // 'cotizacion_dolar', // Cotización del dólar
        // 'personal',
        // 'clientes',
        // 'productos_servicios',
        // 'unidades_negocio',
        // 'trabajadores',
      ];

      // Obtener todas las tablas de la base de datos
      const placeholders = excludedTables.map((_, index) => `$${index + 1}`).join(',');
      const tables = await queryRunner.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (${placeholders})
        ORDER BY tablename
      `, excludedTables);

      this.logger.log(`Encontradas ${tables.length} tablas para eliminar`);

      // Eliminar cada tabla
      for (const table of tables) {
        const tableName = table.tablename;
        
        try {
          // Deshabilitar foreign key checks temporalmente
          await queryRunner.query('SET session_replication_role = replica;');
          
          // Eliminar la tabla
          await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
          
          // Rehabilitar foreign key checks
          await queryRunner.query('SET session_replication_role = DEFAULT;');
          
          tablesDropped.push(tableName);
          this.logger.log(`Tabla ${tableName} eliminada exitosamente`);
        } catch (error) {
          this.logger.error(`Error eliminando tabla ${tableName}:`, error.message);
          throw error;
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: `Todas las tablas eliminadas exitosamente. ${tablesDropped.length} tablas fueron eliminadas.`,
        tablesDropped
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error durante la eliminación de tablas:', error);
      throw new Error(`Error eliminando tablas: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async dropAllTablesWithoutExceptions(): Promise<{ message: string; tablesDropped: string[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    const tablesDropped: string[] = [];

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Obtener TODAS las tablas de la base de datos
      const tables = await queryRunner.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
      `);

      this.logger.log(`Encontradas ${tables.length} tablas para eliminar (sin excepciones)`);

      // Eliminar cada tabla
      for (const table of tables) {
        const tableName = table.tablename;
        
        try {
          // Deshabilitar foreign key checks temporalmente
          await queryRunner.query('SET session_replication_role = replica;');
          
          // Eliminar la tabla
          await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
          
          // Rehabilitar foreign key checks
          await queryRunner.query('SET session_replication_role = DEFAULT;');
          
          tablesDropped.push(tableName);
          this.logger.log(`Tabla ${tableName} eliminada exitosamente`);
        } catch (error) {
          this.logger.error(`Error eliminando tabla ${tableName}:`, error.message);
          throw error;
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: `TODAS las tablas eliminadas exitosamente. ${tablesDropped.length} tablas fueron eliminadas.`,
        tablesDropped
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error durante la eliminación de todas las tablas:', error);
      throw new Error(`Error eliminando todas las tablas: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
} 