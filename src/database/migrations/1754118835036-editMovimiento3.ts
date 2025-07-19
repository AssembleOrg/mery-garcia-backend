import { MigrationInterface, QueryRunner } from "typeorm";

export class EditMovimiento31754118835036 implements MigrationInterface {
    name = 'EditMovimiento31754118835036'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP CONSTRAINT "FK_484bb7f83f81927885b0ae455fd"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "comandasId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD CONSTRAINT "FK_484bb7f83f81927885b0ae455fd" FOREIGN KEY ("comandasId") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movimientos" DROP CONSTRAINT "FK_484bb7f83f81927885b0ae455fd"`);
        await queryRunner.query(`ALTER TABLE "movimientos" ALTER COLUMN "comandasId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "movimientos" ADD CONSTRAINT "FK_484bb7f83f81927885b0ae455fd" FOREIGN KEY ("comandasId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
