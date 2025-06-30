import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1751263817025 implements MigrationInterface {
    name = 'InitialMigration1751263817025'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."unidad_negocio_enum" AS ENUM('tattoo', 'estilismo', 'formacion')`);
        await queryRunner.query(`CREATE TABLE "personal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(100) NOT NULL, "comisionPorcentaje" numeric(5,2) NOT NULL DEFAULT '0', "activo" boolean NOT NULL DEFAULT true, "unidadDisponible" "public"."unidad_negocio_enum" NOT NULL DEFAULT 'tattoo', "telefono" character varying, "fechaIngreso" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7a849a61cdfe8eee39892d7b1b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."item_comanda_tipo_enum" AS ENUM('producto', 'servicio')`);
        await queryRunner.query(`CREATE TABLE "item_comanda" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "producto_servicio_id" character varying NOT NULL, "nombre" character varying(150) NOT NULL, "tipo" "public"."item_comanda_tipo_enum" NOT NULL, "precio" numeric(12,2) NOT NULL DEFAULT '0', "cantidad" integer NOT NULL DEFAULT '1', "descuento" numeric(12,2) NOT NULL DEFAULT '0', "subtotal" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "comanda_id" uuid, "personal_id" uuid, CONSTRAINT "PK_8728bb62f38e703782a25a9a7cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."prepagos_moneda_enum" AS ENUM('pesos', 'dolares')`);
        await queryRunner.query(`CREATE TABLE "prepagos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "monto" numeric(12,2) NOT NULL DEFAULT '0', "moneda" "public"."prepagos_moneda_enum" NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "observaciones" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "comanda_id" uuid, CONSTRAINT "REL_0405d8dc2be7786b4db076a7b5" UNIQUE ("comanda_id"), CONSTRAINT "PK_9b7cf5c685f190da9961dd97464" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."metodos_pago_tipo_enum" AS ENUM('efectivo', 'tarjeta', 'transferencia')`);
        await queryRunner.query(`CREATE TABLE "metodos_pago" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" "public"."metodos_pago_tipo_enum" NOT NULL, "monto" numeric(12,2) NOT NULL DEFAULT '0', "recargo_porcentaje" numeric(5,2) NOT NULL DEFAULT '0', "monto_final" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "comandaId" uuid, CONSTRAINT "PK_f0a766e84c240f201c5cd87c286" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comisiones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "personal_id" character varying(36) NOT NULL, "personal_nombre" character varying(100) NOT NULL, "item_comanda_id" character varying(36) NOT NULL, "monto_base" numeric(12,2) NOT NULL DEFAULT '0', "porcentaje" numeric(5,2) NOT NULL DEFAULT '0', "monto_comision" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "comandaId" uuid, "itemComandaId" uuid, CONSTRAINT "PK_88764b006b7b1cf80c27bbc8ff8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."comandas_unidadnegocio_enum" AS ENUM('tattoo', 'estilismo', 'formacion')`);
        await queryRunner.query(`CREATE TYPE "public"."comandas_estado_enum" AS ENUM('pendiente', 'en_proceso', 'completado', 'cancelado')`);
        await queryRunner.query(`CREATE TYPE "public"."comandas_tipo_enum" AS ENUM('ingreso', 'egreso')`);
        await queryRunner.query(`CREATE TABLE "comandas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numero" character varying(50) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL, "unidadNegocio" "public"."comandas_unidadnegocio_enum" NOT NULL, "subtotal" numeric(12,2) NOT NULL DEFAULT '0', "totalDescuentos" numeric(12,2) NOT NULL DEFAULT '0', "totalRecargos" numeric(12,2) NOT NULL DEFAULT '0', "total_prepago" numeric(12,2) NOT NULL DEFAULT '0', "totalFinal" numeric(12,2) NOT NULL DEFAULT '0', "estado" "public"."comandas_estado_enum" NOT NULL DEFAULT 'pendiente', "tipo" "public"."comandas_tipo_enum" NOT NULL, "observaciones" character varying(500), "version" integer NOT NULL, "cliente_id" uuid, "personal_principal_id" uuid, "prepago_id" uuid, CONSTRAINT "UQ_f6109a27319264e8e7f984b74dc" UNIQUE ("numero"), CONSTRAINT "REL_50df811e61e17750cdfd81cdbf" UNIQUE ("prepago_id"), CONSTRAINT "PK_f2a79c4679e1b8f6342d758f964" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cuit" character varying(20), "nombre" character varying(100) NOT NULL, "telefono" character varying NOT NULL DEFAULT '', "email" character varying NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_4e4e45a41c5515a2be18332550e" UNIQUE ("cuit"), CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."prepagos_guardados_moneda_enum" AS ENUM('pesos', 'dolares')`);
        await queryRunner.query(`CREATE TYPE "public"."prepagos_guardados_estado_enum" AS ENUM('activa', 'utilizada', 'vencida')`);
        await queryRunner.query(`CREATE TABLE "prepagos_guardados" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "monto" numeric(12,2) NOT NULL DEFAULT '0', "moneda" "public"."prepagos_guardados_moneda_enum" NOT NULL, "fechaCreacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fechaVencimiento" TIMESTAMP WITH TIME ZONE, "estado" "public"."prepagos_guardados_estado_enum" NOT NULL, "observaciones" character varying NOT NULL DEFAULT '', "deletedAt" TIMESTAMP WITH TIME ZONE, "cliente_id" uuid, CONSTRAINT "PK_ffb59a7b777c19dabe9b7239313" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comanda_metodos_pago" ("comandasId" uuid NOT NULL, "metodosPagoId" uuid NOT NULL, CONSTRAINT "PK_5ce61595c3a3bae2045a42ff6ea" PRIMARY KEY ("comandasId", "metodosPagoId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5e198d3d230fc7176e11a40bd" ON "comanda_metodos_pago" ("comandasId") `);
        await queryRunner.query(`CREATE INDEX "IDX_001f20da7a66c1b3baccf89f95" ON "comanda_metodos_pago" ("metodosPagoId") `);
        await queryRunner.query(`ALTER TABLE "item_comanda" ADD CONSTRAINT "FK_18982a39318addde0a94de5f760" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_comanda" ADD CONSTRAINT "FK_3e98330c0290e6e09ca226d8eed" FOREIGN KEY ("personal_id") REFERENCES "personal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prepagos" ADD CONSTRAINT "FK_0405d8dc2be7786b4db076a7b59" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" ADD CONSTRAINT "FK_2404d3719ceedf7ed45fc41a4d0" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comisiones" ADD CONSTRAINT "FK_f57c54586f357fb79775fe193e0" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comisiones" ADD CONSTRAINT "FK_f4575eba6a94c796a9ca9614370" FOREIGN KEY ("itemComandaId") REFERENCES "item_comanda"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_3a1963fc84ed639f0160abfe9b4" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_91ada5448a52ed67dfbea637790" FOREIGN KEY ("personal_principal_id") REFERENCES "personal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD CONSTRAINT "FK_50df811e61e17750cdfd81cdbf6" FOREIGN KEY ("prepago_id") REFERENCES "prepagos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" ADD CONSTRAINT "FK_5bc0ab56327fa086edadeac937a" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comanda_metodos_pago" ADD CONSTRAINT "FK_d5e198d3d230fc7176e11a40bdf" FOREIGN KEY ("comandasId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "comanda_metodos_pago" ADD CONSTRAINT "FK_001f20da7a66c1b3baccf89f95c" FOREIGN KEY ("metodosPagoId") REFERENCES "metodos_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comanda_metodos_pago" DROP CONSTRAINT "FK_001f20da7a66c1b3baccf89f95c"`);
        await queryRunner.query(`ALTER TABLE "comanda_metodos_pago" DROP CONSTRAINT "FK_d5e198d3d230fc7176e11a40bdf"`);
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" DROP CONSTRAINT "FK_5bc0ab56327fa086edadeac937a"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_50df811e61e17750cdfd81cdbf6"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_91ada5448a52ed67dfbea637790"`);
        await queryRunner.query(`ALTER TABLE "comandas" DROP CONSTRAINT "FK_3a1963fc84ed639f0160abfe9b4"`);
        await queryRunner.query(`ALTER TABLE "comisiones" DROP CONSTRAINT "FK_f4575eba6a94c796a9ca9614370"`);
        await queryRunner.query(`ALTER TABLE "comisiones" DROP CONSTRAINT "FK_f57c54586f357fb79775fe193e0"`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" DROP CONSTRAINT "FK_2404d3719ceedf7ed45fc41a4d0"`);
        await queryRunner.query(`ALTER TABLE "prepagos" DROP CONSTRAINT "FK_0405d8dc2be7786b4db076a7b59"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP CONSTRAINT "FK_3e98330c0290e6e09ca226d8eed"`);
        await queryRunner.query(`ALTER TABLE "item_comanda" DROP CONSTRAINT "FK_18982a39318addde0a94de5f760"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_001f20da7a66c1b3baccf89f95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5e198d3d230fc7176e11a40bd"`);
        await queryRunner.query(`DROP TABLE "comanda_metodos_pago"`);
        await queryRunner.query(`DROP TABLE "prepagos_guardados"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_guardados_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_guardados_moneda_enum"`);
        await queryRunner.query(`DROP TABLE "clientes"`);
        await queryRunner.query(`DROP TABLE "comandas"`);
        await queryRunner.query(`DROP TYPE "public"."comandas_tipo_enum"`);
        await queryRunner.query(`DROP TYPE "public"."comandas_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."comandas_unidadnegocio_enum"`);
        await queryRunner.query(`DROP TABLE "comisiones"`);
        await queryRunner.query(`DROP TABLE "metodos_pago"`);
        await queryRunner.query(`DROP TYPE "public"."metodos_pago_tipo_enum"`);
        await queryRunner.query(`DROP TABLE "prepagos"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_moneda_enum"`);
        await queryRunner.query(`DROP TABLE "item_comanda"`);
        await queryRunner.query(`DROP TYPE "public"."item_comanda_tipo_enum"`);
        await queryRunner.query(`DROP TABLE "personal"`);
        await queryRunner.query(`DROP TYPE "public"."unidad_negocio_enum"`);
    }

}
