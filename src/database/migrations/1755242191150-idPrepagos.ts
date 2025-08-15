import { MigrationInterface, QueryRunner } from "typeorm";

export class IdPrepagos1755242191150 implements MigrationInterface {
    name = 'IdPrepagos1755242191150'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" ADD "prepagoARSID" uuid`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "prepagoUSDID" uuid`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_34f0195b5d1ee2772c37f58d6fb" FOREIGN KEY ("prepagoARSID") REFERENCES "prepagos_guardados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_372c1722ce84efa1a1b13c8206b" FOREIGN KEY ("prepagoUSDID") REFERENCES "prepagos_guardados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_372c1722ce84efa1a1b13c8206b"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_34f0195b5d1ee2772c37f58d6fb"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "prepagoUSDID"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "prepagoARSID"`);
    }

}
