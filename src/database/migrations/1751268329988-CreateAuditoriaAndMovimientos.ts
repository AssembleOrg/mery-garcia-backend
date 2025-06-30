import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditoriaAndMovimientos1751268329988 implements MigrationInterface {
    name = 'CreateAuditoriaAndMovimientos1751268329988'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tipo_movimiento_enum" AS ENUM('ingreso', 'egreso', 'transferencia_entrada', 'transferencia_salida', 'ajuste')`);
        await queryRunner.query(`CREATE TABLE "movimientos_caja" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "caja" "public"."caja_enum" NOT NULL, "tipoMovimiento" "public"."tipo_movimiento_enum" NOT NULL, "monto" numeric(12,2) NOT NULL, "saldoAnterior" numeric(12,2) NOT NULL, "saldoPosterior" numeric(12,2) NOT NULL, "observaciones" character varying(500) NOT NULL, "referencia" character varying(100), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "usuario_id" uuid, CONSTRAINT "PK_a35825837a156d21e0b922fa627" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tipo_accion_enum" AS ENUM('usuario_creado', 'usuario_modificado', 'usuario_eliminado', 'usuario_login', 'usuario_logout', 'caja_movimiento', 'caja_transferencia', 'caja_balance_consultado', 'comanda_creada', 'comanda_modificada', 'comanda_eliminada', 'comanda_completada', 'cliente_creado', 'cliente_modificado', 'cliente_eliminado', 'prepago_creado', 'prepago_modificado', 'prepago_eliminado', 'comision_creada', 'comision_modificada', 'comision_eliminada')`);
        await queryRunner.query(`CREATE TYPE "public"."modulo_sistema_enum" AS ENUM('auth', 'personal', 'caja', 'comanda', 'cliente', 'prepago', 'comision', 'sistema')`);
        await queryRunner.query(`CREATE TABLE "auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipoAccion" "public"."tipo_accion_enum" NOT NULL, "modulo" "public"."modulo_sistema_enum" NOT NULL, "descripcion" character varying(255) NOT NULL, "datosAnteriores" jsonb, "datosNuevos" jsonb, "observaciones" character varying(500), "ipAddress" character varying(45), "userAgent" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "usuario_id" uuid, CONSTRAINT "PK_135fe98308816fe3a2d458e6637" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "movimientos_caja" ADD CONSTRAINT "FK_54e0399df650a63fc8896df47f8" FOREIGN KEY ("usuario_id") REFERENCES "personal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auditoria" ADD CONSTRAINT "FK_e3351946be53c7cd3286ed4c49d" FOREIGN KEY ("usuario_id") REFERENCES "personal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auditoria" DROP CONSTRAINT "FK_e3351946be53c7cd3286ed4c49d"`);
        await queryRunner.query(`ALTER TABLE "movimientos_caja" DROP CONSTRAINT "FK_54e0399df650a63fc8896df47f8"`);
        await queryRunner.query(`DROP TABLE "auditoria"`);
        await queryRunner.query(`DROP TYPE "public"."modulo_sistema_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tipo_accion_enum"`);
        await queryRunner.query(`DROP TABLE "movimientos_caja"`);
        await queryRunner.query(`DROP TYPE "public"."tipo_movimiento_enum"`);
    }

}
