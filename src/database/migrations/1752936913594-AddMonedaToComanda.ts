import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMonedaToComanda1752936913594 implements MigrationInterface {
    name = 'AddMonedaToComanda1752936913594'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."comandas_moneda_enum" AS ENUM('pesos', 'dolares')`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "moneda" "public"."comandas_moneda_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "moneda"`);
        await queryRunner.query(`DROP TYPE "public"."comandas_moneda_enum"`);
    }

}
