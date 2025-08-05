import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMovimiento1754408631256 implements MigrationInterface {
    name = 'RelationMovimiento1754408631256'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "esIngreso" boolean`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "esIngreso"`);
    }

}
