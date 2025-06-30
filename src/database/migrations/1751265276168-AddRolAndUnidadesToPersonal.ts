import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRolAndUnidadesToPersonal1751265276168 implements MigrationInterface {
    name = 'AddRolAndUnidadesToPersonal1751265276168'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "unidadDisponible"`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "email" character varying(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "personal" ADD CONSTRAINT "UQ_70d5093c89e28f09e712a6ab572" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "password" character varying(255) NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."rol_personal_enum" AS ENUM('admin', 'user')`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "rol" "public"."rol_personal_enum" NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "unidadesDisponibles" "public"."unidad_negocio_enum" array NOT NULL DEFAULT ARRAY['tattoo']::unidad_negocio_enum[]`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "unidadesDisponibles"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "rol"`);
        await queryRunner.query(`DROP TYPE "public"."rol_personal_enum"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "password"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP CONSTRAINT "UQ_70d5093c89e28f09e712a6ab572"`);
        await queryRunner.query(`ALTER TABLE "personal" DROP COLUMN "email"`);
        await queryRunner.query(`CREATE TYPE "public"."unidad_negocio_enum" AS ENUM('tattoo', 'estilismo', 'formacion')`);
        await queryRunner.query(`ALTER TABLE "personal" ADD "unidadDisponible" "public"."unidad_negocio_enum" NOT NULL DEFAULT 'tattoo'`);
    }

}
