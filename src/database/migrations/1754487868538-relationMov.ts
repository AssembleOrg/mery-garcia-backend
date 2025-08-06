import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMov1754487868538 implements MigrationInterface {
    name = 'RelationMov1754487868538'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "UQ_4e4e45a41c5515a2be18332550e"`);
        await queryRunner.query(`ALTER TABLE "clientes" DROP CONSTRAINT "UQ_7738d56540b66e2c1a89cbde563"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "UQ_7738d56540b66e2c1a89cbde563" UNIQUE ("dni")`);
        await queryRunner.query(`ALTER TABLE "clientes" ADD CONSTRAINT "UQ_4e4e45a41c5515a2be18332550e" UNIQUE ("cuit")`);
    }

}
