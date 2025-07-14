import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTimezoneTransformers1752470558603 implements MigrationInterface {
    name = 'UpdateTimezoneTransformers1752470558603'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "unidadesDisponibles" SET DEFAULT ARRAY['tattoo']::unidad_negocio_enum[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "unidadesDisponibles" SET DEFAULT ARRAY['tattoo']::unidad_negocio_enum[]`);
    }

}
