import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCajaToEgreso1730862000000 implements MigrationInterface {
    name = 'AddCajaToEgreso1730862000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar si la columna ya existe
        const table = await queryRunner.getTable('egreso');
        const columnExists = table?.columns.find(column => column.name === 'caja');

        if (!columnExists) {
            // Agregar columna caja con valor por defecto CAJA_1
            await queryRunner.query(`
                ALTER TABLE "egreso" 
                ADD COLUMN "caja" VARCHAR NOT NULL DEFAULT 'CAJA_1'
            `);
            console.log('✅ Columna caja agregada a tabla egreso con valor por defecto CAJA_1');
        } else {
            console.log('ℹ️  Columna caja ya existe en tabla egreso, omitiendo...');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar columna caja
        await queryRunner.query(`
            ALTER TABLE "egreso" 
            DROP COLUMN "caja"
        `);

        console.log('⏪ Columna caja eliminada de tabla egreso');
    }
}

