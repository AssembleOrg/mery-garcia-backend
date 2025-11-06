import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

async function fixEgresosTimestamps() {
  console.log('🔧 Iniciando actualización de timestamps de egresos...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL && process.env.POSTGRES_URL.includes('railway') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a la base de datos\n');

    // Consultar todos los egresos
    const result = await dataSource.query(`
      SELECT COUNT(*) as total FROM egreso
    `);
    
    const totalEgresos = parseInt(result[0].total);
    console.log(`📊 Total de egresos encontrados: ${totalEgresos}\n`);

    if (totalEgresos === 0) {
      console.log('ℹ️  No hay egresos para actualizar');
      await dataSource.destroy();
      return;
    }

    // Actualizar todos los egresos a octubre 2025
    // Fecha: 15 de octubre de 2025 a las 12:00:00 GMT-3
    const fechaOctubre = '2025-10-15 12:00:00-03:00';

    console.log(`🔄 Actualizando todos los egresos a: ${fechaOctubre}`);
    
    const updateResult = await dataSource.query(`
      UPDATE egreso 
      SET 
        "createdAt" = $1::timestamptz,
        "updatedAt" = $1::timestamptz
      WHERE "createdAt" IS NOT NULL OR "updatedAt" IS NOT NULL
    `, [fechaOctubre]);

    console.log(`✅ ${updateResult[1]} egresos actualizados exitosamente\n`);

    // Verificar el resultado
    const verification = await dataSource.query(`
      SELECT 
        COUNT(*) as total,
        MIN("createdAt") as min_created,
        MAX("createdAt") as max_created
      FROM egreso
    `);

    console.log('📋 Verificación:');
    console.log(`   Total de egresos: ${verification[0].total}`);
    console.log(`   Fecha mínima createdAt: ${verification[0].min_created}`);
    console.log(`   Fecha máxima createdAt: ${verification[0].max_created}`);
    
    console.log('\n✅ Proceso completado exitosamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar el script
fixEgresosTimestamps()
  .then(() => {
    console.log('\n🎉 Script finalizado con éxito');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script falló:', error);
    process.exit(1);
  });

