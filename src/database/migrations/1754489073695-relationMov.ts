import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMov1754489073695 implements MigrationInterface {
    name = 'RelationMov1754489073695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."metodos_pago_tipo_enum" RENAME TO "metodos_pago_tipo_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."metodos_pago_tipo_enum" AS ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE', 'QR', 'GIFT_CARD')`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" ALTER COLUMN "tipo" TYPE "public"."metodos_pago_tipo_enum" USING "tipo"::"text"::"public"."metodos_pago_tipo_enum"`);
        await queryRunner.query(`DROP TYPE "public"."metodos_pago_tipo_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."metodos_pago_tipo_enum_old" AS ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE')`);
        await queryRunner.query(`ALTER TABLE "metodos_pago" ALTER COLUMN "tipo" TYPE "public"."metodos_pago_tipo_enum_old" USING "tipo"::"text"::"public"."metodos_pago_tipo_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."metodos_pago_tipo_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."metodos_pago_tipo_enum_old" RENAME TO "metodos_pago_tipo_enum"`);
    }

}
