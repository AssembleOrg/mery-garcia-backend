import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMovimiento1754407864071 implements MigrationInterface {
    name = 'RelationMovimiento1754407864071'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "comentario" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "comentario"`);
    }

}
