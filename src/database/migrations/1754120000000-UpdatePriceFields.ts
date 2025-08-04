import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePriceFields1754120000000 implements MigrationInterface {
  name = 'UpdatePriceFields1754120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update Comanda entity price fields
    await queryRunner.query(`
      ALTER TABLE "comandas" 
      ALTER COLUMN "precioDolar" TYPE numeric(20,2),
      ALTER COLUMN "precioPesos" TYPE numeric(20,2),
      ALTER COLUMN "valorDolar" TYPE numeric(20,2)
    `);

    // Update ProductoServicio entity price fields
    await queryRunner.query(`
      ALTER TABLE "productos_servicios" 
      ALTER COLUMN "precio" TYPE numeric(20,2),
      ALTER COLUMN "precioFijoARS" TYPE numeric(20,2)
    `);

    // Update ItemComanda entity price fields
    await queryRunner.query(`
      ALTER TABLE "item_comanda" 
      ALTER COLUMN "precio" TYPE numeric(20,2),
      ALTER COLUMN "descuento" TYPE numeric(20,2),
      ALTER COLUMN "subtotal" TYPE numeric(20,2)
    `);

    // Update CotizacionDolar entity price fields
    await queryRunner.query(`
      ALTER TABLE "cotizaciones_dolar" 
      ALTER COLUMN "compra" TYPE numeric(20,2),
      ALTER COLUMN "venta" TYPE numeric(20,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Comanda entity price fields
    await queryRunner.query(`
      ALTER TABLE "comandas" 
      ALTER COLUMN "precioDolar" TYPE numeric(12,4),
      ALTER COLUMN "precioPesos" TYPE numeric(12,4),
      ALTER COLUMN "valorDolar" TYPE numeric(12,4)
    `);

    // Revert ProductoServicio entity price fields
    await queryRunner.query(`
      ALTER TABLE "productos_servicios" 
      ALTER COLUMN "precio" TYPE numeric(12,4),
      ALTER COLUMN "precioFijoARS" TYPE numeric(12,4)
    `);

    // Revert ItemComanda entity price fields
    await queryRunner.query(`
      ALTER TABLE "item_comanda" 
      ALTER COLUMN "precio" TYPE numeric(12,2),
      ALTER COLUMN "descuento" TYPE numeric(12,2),
      ALTER COLUMN "subtotal" TYPE numeric(12,2)
    `);

    // Revert CotizacionDolar entity price fields
    await queryRunner.query(`
      ALTER TABLE "cotizaciones_dolar" 
      ALTER COLUMN "compra" TYPE decimal(10,2),
      ALTER COLUMN "venta" TYPE decimal(10,2)
    `);
  }
} 