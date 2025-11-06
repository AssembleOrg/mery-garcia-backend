import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampsToEgreso1730863000000 implements MigrationInterface {
    name = 'AddTimestampsToEgreso1730863000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar si las columnas ya existen
        const table = await queryRunner.getTable('egreso');
        const createdAtExists = table?.columns.find(column => column.name === 'createdAt');
        const updatedAtExists = table?.columns.find(column => column.name === 'updatedAt');
        const deletedAtExists = table?.columns.find(column => column.name === 'deletedAt');

        if (!createdAtExists) {
            // Agregar columna createdAt con valor por defecto de octubre 2025 en GMT-3
            await queryRunner.query(`
                ALTER TABLE "egreso" 
                ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT '2025-10-15 12:00:00-03:00'
            `);
            console.log('✅ Columna createdAt agregada a tabla egreso con fecha octubre 2025');
        } else {
            console.log('ℹ️  Columna createdAt ya existe en tabla egreso, omitiendo...');
        }

        if (!updatedAtExists) {
            // Agregar columna updatedAt con valor por defecto de octubre 2025 en GMT-3
            await queryRunner.query(`
                ALTER TABLE "egreso" 
                ADD COLUMN "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT '2025-10-15 12:00:00-03:00'
            `);
            console.log('✅ Columna updatedAt agregada a tabla egreso con fecha octubre 2025');
        } else {
            console.log('ℹ️  Columna updatedAt ya existe en tabla egreso, omitiendo...');
        }

        if (!deletedAtExists) {
            // Agregar columna deletedAt (nullable)
            await queryRunner.query(`
                ALTER TABLE "egreso" 
                ADD COLUMN "deletedAt" TIMESTAMPTZ NULL
            `);
            console.log('✅ Columna deletedAt agregada a tabla egreso (nullable)');
        } else {
            console.log('ℹ️  Columna deletedAt ya existe en tabla egreso, omitiendo...');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar columnas en orden inverso
        await queryRunner.query(`ALTER TABLE "egreso" DROP COLUMN IF EXISTS "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "egreso" DROP COLUMN IF EXISTS "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "egreso" DROP COLUMN IF EXISTS "createdAt"`);
        
        console.log('⏪ Columnas de timestamps eliminadas de tabla egreso');
    }
}

