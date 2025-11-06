/**
 * Script para corregir las fechas de los movimientos
 * Resta 3 horas de todas las fechas de movimientos
 * 
 * Uso:
 * npm run ts-node scripts/fix-movimientos-timezone.ts
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno
config({ path: join(__dirname, '..', '.env') });

async function corregirFechasMovimientos() {
  console.log('🔧 Iniciando corrección de fechas de movimientos...\n');

  // Crear conexión a la base de datos usando la misma configuración que el datasource
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL && process.env.POSTGRES_URL.includes('railway') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conexión a base de datos establecida\n');

    // Obtener el conteo de movimientos
    const countResult = await dataSource.query(
      'SELECT COUNT(*) as total FROM movimientos WHERE "deletedAt" IS NULL'
    );
    const totalMovimientos = parseInt(countResult[0].total);
    
    console.log(`📊 Total de movimientos a actualizar: ${totalMovimientos}\n`);

    if (totalMovimientos === 0) {
      console.log('ℹ️  No hay movimientos para actualizar');
      return;
    }

    // Mostrar algunos ejemplos de fechas antes de la corrección
    console.log('📅 Ejemplos de fechas ANTES de la corrección:');
    const ejemplosAntes = await dataSource.query(`
      SELECT 
        id, 
        "createdAt", 
        "updatedAt"
      FROM movimientos 
      WHERE "deletedAt" IS NULL 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    ejemplosAntes.forEach((mov: any, idx: number) => {
      console.log(`  ${idx + 1}. ID: ${mov.id.substring(0, 8)}...`);
      console.log(`     createdAt: ${mov.createdAt}`);
      console.log(`     updatedAt: ${mov.updatedAt}`);
    });
    console.log('');

    // Actualizar las fechas restando 3 horas
    console.log('⏳ Actualizando fechas (restando 3 horas)...');
    
    const updateResult = await dataSource.query(`
      UPDATE movimientos 
      SET 
        "createdAt" = "createdAt" - INTERVAL '3 hours',
        "updatedAt" = "updatedAt" - INTERVAL '3 hours',
        "deletedAt" = CASE 
          WHEN "deletedAt" IS NOT NULL 
          THEN "deletedAt" - INTERVAL '3 hours' 
          ELSE NULL 
        END
      WHERE "deletedAt" IS NULL
    `);

    console.log(`✅ ${updateResult[1]} movimientos actualizados\n`);

    // Mostrar algunos ejemplos de fechas después de la corrección
    console.log('📅 Ejemplos de fechas DESPUÉS de la corrección:');
    const ejemplosDespues = await dataSource.query(`
      SELECT 
        id, 
        "createdAt", 
        "updatedAt"
      FROM movimientos 
      WHERE "deletedAt" IS NULL 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    ejemplosDespues.forEach((mov: any, idx: number) => {
      console.log(`  ${idx + 1}. ID: ${mov.id.substring(0, 8)}...`);
      console.log(`     createdAt: ${mov.createdAt}`);
      console.log(`     updatedAt: ${mov.updatedAt}`);
    });
    console.log('');

    // Calcular la diferencia
    console.log('📊 Resumen de la corrección:');
    const diferencias = await dataSource.query(`
      SELECT 
        COUNT(*) as total,
        MIN("createdAt") as fecha_mas_antigua,
        MAX("createdAt") as fecha_mas_reciente
      FROM movimientos
      WHERE "deletedAt" IS NULL
    `);
    
    console.log(`  Total actualizado: ${diferencias[0].total}`);
    console.log(`  Fecha más antigua: ${diferencias[0].fecha_mas_antigua}`);
    console.log(`  Fecha más reciente: ${diferencias[0].fecha_mas_reciente}`);
    console.log('');

    console.log('✅ Corrección completada exitosamente!\n');
    console.log('⚠️  IMPORTANTE: Recuerda ejecutar "npm run build" para recompilar con los cambios en la entidad');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('👋 Conexión a base de datos cerrada');
    }
  }
}

// Ejecutar el script
corregirFechasMovimientos()
  .then(() => {
    console.log('\n✨ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

