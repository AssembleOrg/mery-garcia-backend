import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMov1754412419685 implements MigrationInterface {
    name = 'RelationMov1754412419685'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "montoARS" TYPE numeric(30,2)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "montoUSD" TYPE numeric(30,2)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "residualARS" TYPE numeric(30,2)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "residualUSD" TYPE numeric(30,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "residualUSD" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "residualARS" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "montoUSD" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "montoARS" TYPE numeric(12,4)`);
    }

}
