import { DataSource } from 'typeorm';
import { TipoComanda } from '../comanda/entities/TipoComanda.entity';
import { TipoItem } from '../comanda/entities/TipoItem.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URL || 'postgresql://postgres:password@localhost:5432/mery_garcia',
  entities: [TipoComanda, TipoItem],
  synchronize: false,
});

async function populateTipos() {
  try {
    await dataSource.initialize();
    console.log('Conexión a la base de datos establecida');

    const tipoComandaRepository = dataSource.getRepository(TipoComanda);
    const tipoItemRepository = dataSource.getRepository(TipoItem);

    // Crear tipos de comanda
    const tiposComanda = [
      {
        nombre: 'Ingreso',
        descripcion: 'Comandas de ingreso de dinero',
        orden: 1,
        activo: true,
      },
      {
        nombre: 'Egreso',
        descripcion: 'Comandas de egreso de dinero',
        orden: 2,
        activo: true,
      },
    ];

    for (const tipoData of tiposComanda) {
      const tipoExistente = await tipoComandaRepository.findOne({
        where: { nombre: tipoData.nombre },
      });

      if (!tipoExistente) {
        const nuevoTipo = tipoComandaRepository.create(tipoData);
        await tipoComandaRepository.save(nuevoTipo);
        console.log(`Tipo de comanda "${tipoData.nombre}" creado`);
      } else {
        console.log(`Tipo de comanda "${tipoData.nombre}" ya existe`);
      }
    }

    // Crear tipos de item
    const tiposItem = [
      {
        nombre: 'Producto',
        descripcion: 'Productos físicos',
        orden: 1,
        activo: true,
      },
      {
        nombre: 'Servicio',
        descripcion: 'Servicios prestados',
        orden: 2,
        activo: true,
      },
    ];

    for (const tipoData of tiposItem) {
      const tipoExistente = await tipoItemRepository.findOne({
        where: { nombre: tipoData.nombre },
      });

      if (!tipoExistente) {
        const nuevoTipo = tipoItemRepository.create(tipoData);
        await tipoItemRepository.save(nuevoTipo);
        console.log(`Tipo de item "${tipoData.nombre}" creado`);
      } else {
        console.log(`Tipo de item "${tipoData.nombre}" ya existe`);
      }
    }

    console.log('Población de tipos completada exitosamente');
  } catch (error) {
    console.error('Error durante la población de tipos:', error);
  } finally {
    await dataSource.destroy();
  }
}

populateTipos(); 