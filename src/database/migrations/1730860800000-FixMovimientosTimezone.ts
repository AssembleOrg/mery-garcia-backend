import { MigrationInterface, QueryRunner } from "typeorm";

export class FixMovimientosTimezone1730860800000 implements MigrationInterface {
    name = 'FixMovimientosTimezone1730860800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Cambiar el tipo de columna de timestamp a timestamptz
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'
        `);
        
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'
        `);
        
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "deletedAt" TYPE timestamptz USING "deletedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'
        `);

        console.log('✅ Columnas de movimientos actualizadas a timestamptz');
        console.log('⚠️  IMPORTANTE: Ejecuta "npm run fix-movimientos-timezone" para corregir las fechas existentes');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revertir los cambios
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "createdAt" TYPE timestamp
        `);
        
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "updatedAt" TYPE timestamp
        `);
        
        await queryRunner.query(`
            ALTER TABLE "movimientos" 
            ALTER COLUMN "deletedAt" TYPE timestamp
        `);

        console.log('⏪ Columnas de movimientos revertidas a timestamp');
    }
}

