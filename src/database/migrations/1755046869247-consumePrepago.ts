import { MigrationInterface, QueryRunner } from "typeorm";

export class ConsumePrepago1755046869247 implements MigrationInterface {
    name = 'ConsumePrepago1755046869247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP CONSTRAINT "FK_metodos_pago_item_comanda"`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "usuarioConsumePrepagoARS" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "usuarioConsumePrepagoUSD" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "precioDolar" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "precioPesos" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "valorDolar" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD CONSTRAINT "FK_b77b4a6f83958cdee4ed86d137a" FOREIGN KEY ("itemComandaId") REFERENCES "item_comanda"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP CONSTRAINT "FK_b77b4a6f83958cdee4ed86d137a"`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "valorDolar" TYPE numeric(20,2)`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "precioPesos" TYPE numeric(20,2)`);
        await queryRunner.query(`ALTER TABLE "comandas" ALTER COLUMN "precioDolar" TYPE numeric(20,2)`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "usuarioConsumePrepagoUSD"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "usuarioConsumePrepagoARS"`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD CONSTRAINT "FK_metodos_pago_item_comanda" FOREIGN KEY ("itemComandaId") REFERENCES "item_comanda"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
