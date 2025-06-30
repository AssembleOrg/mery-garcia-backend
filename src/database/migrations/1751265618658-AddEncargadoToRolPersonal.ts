import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEncargadoToRolPersonal1751265618658 implements MigrationInterface {
    name = 'AddEncargadoToRolPersonal1751265618658'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."rol_personal_enum" RENAME TO "rol_personal_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."rol_personal_enum" AS ENUM('admin', 'user', 'encargado')`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" TYPE "public"."rol_personal_enum" USING "rol"::"text"::"public"."rol_personal_enum"`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" SET DEFAULT 'user'`);
        await queryRunner.query(`DROP TYPE "public"."rol_personal_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."rol_personal_enum_old" AS ENUM('admin', 'user')`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" TYPE "public"."rol_personal_enum_old" USING "rol"::"text"::"public"."rol_personal_enum_old"`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "rol" SET DEFAULT 'user'`);
        await queryRunner.query(`DROP TYPE "public"."rol_personal_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."rol_personal_enum_old" RENAME TO "rol_personal_enum"`);
    }

}
