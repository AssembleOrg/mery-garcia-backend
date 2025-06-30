import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { RolPersonal } from '../enums/RolPersonal.enum';
import { UnidadNegocio } from '../enums/UnidadNegocio.enum';

async function createAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);

  try {
    const adminData = {
      nombre: 'Administrador',
      email: 'admin@merygarcia.com',
      password: 'admin123',
      rol: RolPersonal.ADMIN,
      unidadesDisponibles: [UnidadNegocio.TATTOO, UnidadNegocio.ESTILISMO, UnidadNegocio.FORMACION],
      activo: true,
      comisionPorcentaje: 0,
      fechaIngreso: new Date(),
    };

    const admin = await authService.register(adminData);
    console.log('✅ Usuario administrador creado exitosamente:');
    console.log('Email:', admin.email);
    console.log('Rol:', admin.rol);
    console.log('Unidades disponibles:', admin.unidadesDisponibles);
  } catch (error) {
    if (error.message.includes('ya está registrado')) {
      console.log('ℹ️  El usuario administrador ya existe');
    } else {
      console.error('❌ Error al crear el administrador:', error.message);
    }
  } finally {
    await app.close();
  }
}

createAdmin(); 