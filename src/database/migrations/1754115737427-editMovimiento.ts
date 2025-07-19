import { MigrationInterface, QueryRunner } from "typeorm";

export class EditMovimiento1754115737427 implements MigrationInterface {
    name = 'EditMovimiento1754115737427'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP CONSTRAINT "FK_42425be9429daef9f5718e3168b"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "residual"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "comandaId"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "residualARS" numeric(12,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "residualUSD" numeric(12,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "comandasId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "movimiento_id" uuid`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD CONSTRAINT "FK_484bb7f83f81927885b0ae455fd" FOREIGN KEY ("comandasId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_d6845c5bf7d83a13aaeddc51148" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_d6845c5bf7d83a13aaeddc51148"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP CONSTRAINT "FK_484bb7f83f81927885b0ae455fd"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "movimiento_id"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "comandasId"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "residualUSD"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "residualARS"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "comandaId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "residual" numeric(12,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD CONSTRAINT "FK_42425be9429daef9f5718e3168b" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
