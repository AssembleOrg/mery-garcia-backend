import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeConstraints1755100000000 implements MigrationInterface {
    name = 'AddCascadeConstraints1755100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Agregar foreign keys con CASCADE para comandas -> prepagos (SET NULL)
        await queryRunner.query(`
            ALTER TABLE "comandas" 
            ADD CONSTRAINT "FK_comanda_prepago_ars" 
            FOREIGN KEY ("prepagoARSID") 
            REFERENCES "prepagos_guardados"("id") 
            ON DELETE SET NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE "comandas" 
            ADD CONSTRAINT "FK_comanda_prepago_usd" 
            FOREIGN KEY ("prepagoUSDID") 
            REFERENCES "prepagos_guardados"("id") 
            ON DELETE SET NULL
        `);

        // Verificar y actualizar constrains existentes para asegurar CASCADE
        // Descuentos -> Comanda (CASCADE)
        await queryRunner.query(`
            ALTER TABLE "descuentos" 
            DROP CONSTRAINT IF EXISTS "FK_descuentos_comanda"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "descuentos" 
            ADD CONSTRAINT "FK_descuentos_comanda" 
            FOREIGN KEY ("comandaId") 
            REFERENCES "comandas"("id") 
            ON DELETE CASCADE
        `);

        // Items -> Comanda (CASCADE)
        await queryRunner.query(`
            ALTER TABLE "item_comanda" 
            DROP CONSTRAINT IF EXISTS "FK_item_comanda_comanda"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "item_comanda" 
            ADD CONSTRAINT "FK_item_comanda_comanda" 
            FOREIGN KEY ("comanda_id") 
            REFERENCES "comandas"("id") 
            ON DELETE CASCADE
        `);

        // Métodos de pago -> Item Comanda (CASCADE)
        await queryRunner.query(`
            ALTER TABLE "metodos_pago" 
            DROP CONSTRAINT IF EXISTS "FK_metodos_pago_item_comanda"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "metodos_pago" 
            ADD CONSTRAINT "FK_metodos_pago_item_comanda" 
            FOREIGN KEY ("itemComandaId") 
            REFERENCES "item_comanda"("id") 
            ON DELETE CASCADE
        `);

        // Egresos -> Comanda (CASCADE)
        await queryRunner.query(`
            ALTER TABLE "egreso" 
            DROP CONSTRAINT IF EXISTS "FK_egreso_comanda"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "egreso" 
            ADD CONSTRAINT "FK_egreso_comanda" 
            FOREIGN KEY ("comandaId") 
            REFERENCES "comandas"("id") 
            ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover foreign keys agregadas
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT IF EXISTS "FK_comanda_prepago_ars"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT IF EXISTS "FK_comanda_prepago_usd"`);
        
        // Revertir constrains a su estado original (si es necesario)
        await queryRunner.query(`ALTER TABLE "descuentos" DROP CONSTRAINT IF EXISTS "FK_descuentos_comanda"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP CONSTRAINT IF EXISTS "FK_item_comanda_comanda"`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP CONSTRAINT IF EXISTS "FK_metodos_pago_item_comanda"`);
        await queryRunner.query(`ALTER TABLE "egreso" DROP CONSTRAINT IF EXISTS "FK_egreso_comanda"`);
    }
} 