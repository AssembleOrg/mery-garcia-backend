import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnCajaToComanda1751267178235 implements MigrationInterface {
    name = 'AddEnCajaToComanda1751267178235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."caja_enum" AS ENUM('caja_1', 'caja_2')`);
        await queryRunner.query(`CREATE TABLE "cajas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" "public"."caja_enum" NOT NULL, "descripcion" character varying(100), "activa" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ec47c41e9538256d2b40ee6f5a6" UNIQUE ("nombre"), CONSTRAINT "PK_92b27e5f4ab36a544f37bf45e09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "enCaja" "public"."caja_enum" NOT NULL DEFAULT 'caja_1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "enCaja"`);
        await queryRunner.query(`DROP TABLE "cajas"`);
        await queryRunner.query(`DROP TYPE "public"."caja_enum"`);
    }

}
