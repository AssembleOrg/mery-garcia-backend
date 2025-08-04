import { MigrationInterface, QueryRunner } from "typeorm";

export class DniCliente1754287270929 implements MigrationInterface {
    name = 'DniCliente1754287270929'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" ADD "dni" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "UQ_7738d56540b66e2c1a89cbde563" UNIQUE ("dni")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "UQ_7738d56540b66e2c1a89cbde563"`);
        await queryRunner.query(`ALTER TABLE "clientes" DROP COLUMN "dni"`);
    }

}
