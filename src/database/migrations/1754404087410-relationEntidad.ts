import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationEntidad1754404087410 implements MigrationInterface {
    name = 'RelationEntidad1754404087410'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP CONSTRAINT "FK_484bb7f83f81927885b0ae455fd"`);
        await queryRunner.query(`ALTER TABLE "movimientos" DROP COLUMN "comandasId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" ADD "comandasId" uuid`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD CONSTRAINT "FK_484bb7f83f81927885b0ae455fd" FOREIGN KEY ("comandasId") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
