import { MigrationInterface, QueryRunner } from "typeorm";

export class TipoPago1755057216285 implements MigrationInterface {
    name = 'TipoPago1755057216285'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Crear tipo enum solo para prepagos_guardados (el de prepagos ya existe)
        await queryRunner.query(`CREATE TYPE "public"."prepagos_guardados_tipopago_enum" AS ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'QR', 'GIFT_CARD')`);
        
        // Agregar columna como nullable primero
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" ADD "tipoPago" "public"."prepagos_guardados_tipopago_enum"`);
        
        // Actualizar registros existentes con valor por defecto
        await queryRunner.query(`UPDATE "prepagos_guardados" SET "tipoPago" = 'EFECTIVO' WHERE "tipoPago" IS NULL`);
        
        // Hacer la columna NOT NULL
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" ALTER COLUMN "tipoPago" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" DROP COLUMN "tipoPago"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_guardados_tipopago_enum"`);
    }

}
