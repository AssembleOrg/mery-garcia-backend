import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Caja as CajaEntity } from '../caja/entities/Caja.entity';
import { Caja } from '../enums/Caja.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function populateCajas() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cajaRepository = app.get<Repository<CajaEntity>>(getRepositoryToken(CajaEntity));

  try {
    // Verificar si ya existen cajas
    const existingCajas = await cajaRepository.find();
    
    if (existingCajas.length > 0) {
      console.log('ℹ️  Las cajas ya están pobladas');
      return;
    }

    // Crear cajas iniciales
    const cajas = [
      {
        nombre: Caja.CAJA_1,
        descripcion: 'Caja Principal',
        activa: true,
      },
      {
        nombre: Caja.CAJA_2,
        descripcion: 'Caja Secundaria',
        activa: true,
      },
    ];

    const savedCajas = await cajaRepository.save(cajas);
    
    console.log('✅ Cajas pobladas exitosamente:');
    savedCajas.forEach(caja => {
      console.log(`- ${caja.nombre}: ${caja.descripcion}`);
    });

  } catch (error) {
    console.error('❌ Error al poblar las cajas:', error.message);
  } finally {
    await app.close();
  }
}

populateCajas(); 