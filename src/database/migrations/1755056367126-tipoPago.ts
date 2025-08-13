import { MigrationInterface, QueryRunner } from "typeorm";

export class TipoPago1755056367126 implements MigrationInterface {
    name = 'TipoPago1755056367126'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."prepagos_tipopago_enum" AS ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'QR', 'GIFT_CARD')`);
        await queryRunner.query(`ALTER TABLE "prepagos" ADD "tipoPago" "public"."prepagos_tipopago_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "prepagos" DROP COLUMN "tipoPago"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_tipopago_enum"`);
    }

}
