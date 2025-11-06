/**
 * Script para verificar el estado actual de los movimientos
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

async function verificarMovimientos() {
  console.log('🔍 Verificando estado de movimientos...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL && process.env.POSTGRES_URL.includes('railway') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conexión establecida\n');

    // Obtener todos los movimientos con sus fechas
    const movimientos = await dataSource.query(`
      SELECT 
        id,
        "createdAt",
        "updatedAt",
        "montoARS",
        "montoUSD"
      FROM movimientos 
      WHERE "deletedAt" IS NULL 
      ORDER BY "createdAt" DESC
    `);

    console.log(`📊 Total de movimientos: ${movimientos.length}\n`);

    // Agrupar por fecha
    const porFecha = movimientos.reduce((acc: any, mov: any) => {
      const fecha = new Date(mov.createdAt).toISOString().split('T')[0];
      if (!acc[fecha]) {
        acc[fecha] = 0;
      }
      acc[fecha]++;
      return acc;
    }, {});

    console.log('📅 Distribución por fecha:');
    Object.entries(porFecha)
      .sort()
      .forEach(([fecha, cantidad]) => {
        console.log(`   ${fecha}: ${cantidad} movimientos`);
      });

    console.log('\n📋 Primeros 10 movimientos:');
    movimientos.slice(0, 10).forEach((mov: any, idx: number) => {
      console.log(`   ${idx + 1}. ID: ${mov.id.substring(0, 8)}...`);
      console.log(`      Fecha: ${mov.createdAt}`);
      console.log(`      Monto: ARS ${mov.montoARS} / USD ${mov.montoUSD}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

verificarMovimientos()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

