import { MigrationInterface, QueryRunner } from "typeorm";

export class EditMovimiento21754116196402 implements MigrationInterface {
    name = 'EditMovimiento21754116196402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "monto"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "montoARS" numeric(12,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "montoUSD" numeric(12,4) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "montoUSD"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "montoARS"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "monto" numeric(12,4) NOT NULL DEFAULT '0'`);
    }

}
