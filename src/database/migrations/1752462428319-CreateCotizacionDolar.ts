import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCotizacionDolar1752462428319 implements MigrationInterface {
    name = 'CreateCotizacionDolar1752462428319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cotizaciones_dolar" ("id" SERIAL NOT NULL, "compra" numeric(10,2) NOT NULL, "venta" numeric(10,2) NOT NULL, "casa" character varying(100) NOT NULL, "nombre" character varying(100) NOT NULL, "moneda" character varying(10) NOT NULL DEFAULT 'USD', "fechaActualizacion" TIMESTAMP NOT NULL, "fuente" character varying(50) NOT NULL DEFAULT 'API', "observaciones" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b842f06dec2379d6f04ad4ecd49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "comandas" ADD "precioDolar" numeric(12,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comandas" DROP COLUMN "precioDolar"`);
        await queryRunner.query(`DROP TABLE "cotizaciones_dolar"`);
    }

}
