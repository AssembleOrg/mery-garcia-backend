import { MigrationInterface, QueryRunner } from "typeorm";

export class MoveMetodosPagoToItemComanda1754489073696 implements MigrationInterface {
    name = 'MoveMetodosPagoToItemComanda1754489073696'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Agregar columna itemComandaId a metodos_pago
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD "itemComandaId" uuid`);
        
        // 2. Agregar foreign key constraint
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD CONSTRAINT "FK_metodos_pago_item_comanda" FOREIGN KEY ("itemComandaId") REFERENCES "item_comanda"("id") ON DELETE CASCADE`);
        
        // 3. Verificar si existe la columna comandaId antes de intentar removerla
        const hasComandaIdColumn = await queryRunner.hasColumn("metodos_pago", "comandaId");
        if (hasComandaIdColumn) {
            // 4. Remover la columna comandaId de metodos_pago (esto también removerá el constraint automáticamente)
            await queryRunner.query(`ALTER TABLE "metodos_pago" DROP COLUMN "comandaId"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Agregar columna comandaId de vuelta a metodos_pago
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD "comandaId" uuid`);
        
        // 2. Agregar foreign key constraint de vuelta
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD CONSTRAINT "FK_metodos_pago_comanda" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE`);
        
        // 3. Remover la columna itemComandaId de metodos_pago
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP CONSTRAINT "FK_metodos_pago_item_comanda"`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP COLUMN "itemComandaId"`);
    }
} 