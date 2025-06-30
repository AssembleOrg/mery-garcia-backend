import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTiposAndConfiguracion1751275984794 implements MigrationInterface {
    name = 'CreateTiposAndConfiguracion1751275984794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_comanda" RENAME COLUMN "tipo" TO "tipo_id"`);
        await queryRunner.query(`ALTER TYPE "public"."item_comanda_tipo_enum" RENAME TO "item_comanda_tipo_id_enum"`);
        await queryRunner.query(`ALTER TABLE "comandas" RENAME COLUMN "tipo" TO "tipo_id"`);
        await queryRunner.query(`ALTER TYPE "public"."comandas_tipo_enum" RENAME TO "comandas_tipo_id_enum"`);
        await queryRunner.query(`CREATE TABLE "tipos_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "descripcion" character varying(255), "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_d3c836259e6c5a17a696a9e5541" UNIQUE ("nombre"), CONSTRAINT "PK_e254b4c6964dd95099683a1f172" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tipos_comanda" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "descripcion" character varying(255), "activo" boolean NOT NULL DEFAULT true, "orden" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_b576a78e27c88c81bbdeb731bb5" UNIQUE ("nombre"), CONSTRAINT "PK_fdc493764a0fe35948a8650fe66" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "configuraciones_sistema" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clave" character varying(100) NOT NULL, "valor" text NOT NULL, "descripcion" character varying(255), "activo" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ffcb466ee6c9b2591b9dc6b7f3b" UNIQUE ("clave"), CONSTRAINT "PK_525270e38851bf0ce7434f9cfd7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "unidadesDisponibles" SET DEFAULT ARRAY['tattoo']::unidad_negocio_enum[]`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP COLUMN "tipo_id"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" ADD "tipo_id" uuid`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "tipo_id"`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "tipo_id" uuid`);
        await queryRunner.query(`ALTER TABLE "item_comanda" ADD CONSTRAINT "FK_db6e5bbba92cf6dac01156184d0" FOREIGN KEY ("tipo_id") REFERENCES "tipos_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_0623b39b59a611742e900da88e9" FOREIGN KEY ("tipo_id") REFERENCES "tipos_comanda"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_0623b39b59a611742e900da88e9"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP CONSTRAINT "FK_db6e5bbba92cf6dac01156184d0"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "tipo_id"`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "tipo_id" "public"."comandas_tipo_id_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP COLUMN "tipo_id"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" ADD "tipo_id" "public"."item_comanda_tipo_id_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "personal" ALTER COLUMN "unidadesDisponibles" SET DEFAULT ARRAY['tattoo']::unidad_negocio_enum[]`);
        await queryRunner.query(`DROP TABLE "configuraciones_sistema"`);
        await queryRunner.query(`DROP TABLE "tipos_comanda"`);
        await queryRunner.query(`DROP TABLE "tipos_item"`);
        await queryRunner.query(`ALTER TYPE "public"."comandas_tipo_id_enum" RENAME TO "comandas_tipo_enum"`);
        await queryRunner.query(`ALTER TABLE "comandas" RENAME COLUMN "tipo_id" TO "tipo"`);
        await queryRunner.query(`ALTER TYPE "public"."item_comanda_tipo_id_enum" RENAME TO "item_comanda_tipo_enum"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" RENAME COLUMN "tipo_id" TO "tipo"`);
    }

}
