import { MigrationInterface, QueryRunner } from "typeorm";

export class RelationMov1754419822268 implements MigrationInterface {
    name = 'RelationMov1754419822268'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."prepagos_guardados_estado_enum" RENAME TO "prepagos_guardados_estado_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."prepagos_guardados_estado_enum" AS ENUM('ACTIVO', 'UTILIZADO', 'VENCIDO', 'CANCELADO')`);
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" ALTER COLUMN "estado" TYPE "public"."prepagos_guardados_estado_enum" USING "estado"::"text"::"public"."prepagos_guardados_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_guardados_estado_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."tipo_accion_enum" RENAME TO "tipo_accion_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tipo_accion_enum" AS ENUM('usuario_creado', 'usuario_modificado', 'usuario_eliminado', 'usuario_login', 'usuario_logout', 'usuario_restaurado', 'caja_movimiento', 'caja_transferencia', 'caja_balance_consultado', 'comanda_creada', 'comanda_modificada', 'comanda_eliminada', 'comanda_completada', 'comanda_restaurada', 'comanda_estado_cambiado', 'cliente_creado', 'cliente_modificado', 'cliente_eliminado', 'cliente_restaurado', 'prepago_creado', 'prepago_modificado', 'prepago_eliminado', 'prepago_restaurado', 'prepago_guardado_creado', 'prepago_guardado_modificado', 'prepago_guardado_eliminado', 'prepago_guardado_restaurado', 'comision_creada', 'comision_modificada', 'comision_eliminada', 'comision_restaurada', 'personal_creado', 'personal_modificado', 'personal_eliminado', 'personal_restaurado', 'trabajador_creado', 'trabajador_modificado', 'trabajador_eliminado', 'trabajador_restaurado', 'item_comanda_creado', 'item_comanda_modificado', 'item_comanda_eliminado', 'item_comanda_restaurado', 'movimiento_creado', 'movimiento_modificado', 'movimiento_eliminado', 'movimiento_restaurado', 'producto_servicio_creado', 'producto_servicio_modificado', 'producto_servicio_eliminado', 'producto_servicio_restaurado', 'tipo_item_creado', 'tipo_item_modificado', 'tipo_item_eliminado', 'tipo_item_restaurado', 'unidad_negocio_creada', 'unidad_negocio_modificada', 'unidad_negocio_eliminada', 'unidad_negocio_restaurada', 'config_modificada', 'dolar_actualizado', 'database_cleanup', 'sistema_backup', 'sistema_restore')`);
        await queryRunner.query(`ALTER TABLE "auditoria" ALTER COLUMN "tipoAccion" TYPE "public"."tipo_accion_enum" USING "tipoAccion"::"text"::"public"."tipo_accion_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tipo_accion_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."modulo_sistema_enum" RENAME TO "modulo_sistema_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."modulo_sistema_enum" AS ENUM('auth', 'personal', 'caja', 'comanda', 'cliente', 'prepago', 'comision', 'sistema', 'auditoria', 'config', 'database_cleanup', 'dolar', 'item_comanda', 'movimiento', 'producto_servicio', 'tipo_item', 'unidad_negocio', 'trabajador', 'prepago_guardado')`);
        await queryRunner.query(`ALTER TABLE "auditoria" ALTER COLUMN "modulo" TYPE "public"."modulo_sistema_enum" USING "modulo"::"text"::"public"."modulo_sistema_enum"`);
        await queryRunner.query(`DROP TYPE "public"."modulo_sistema_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."modulo_sistema_enum_old" AS ENUM('auth', 'personal', 'caja', 'comanda', 'cliente', 'prepago', 'comision', 'sistema')`);
        await queryRunner.query(`ALTER TABLE "auditoria" ALTER COLUMN "modulo" TYPE "public"."modulo_sistema_enum_old" USING "modulo"::"text"::"public"."modulo_sistema_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."modulo_sistema_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."modulo_sistema_enum_old" RENAME TO "modulo_sistema_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."tipo_accion_enum_old" AS ENUM('usuario_creado', 'usuario_modificado', 'usuario_eliminado', 'usuario_login', 'usuario_logout', 'caja_movimiento', 'caja_transferencia', 'caja_balance_consultado', 'comanda_creada', 'comanda_modificada', 'comanda_eliminada', 'comanda_completada', 'comanda_restaurada', 'cliente_creado', 'cliente_modificado', 'cliente_eliminado', 'prepago_creado', 'prepago_modificado', 'prepago_eliminado', 'comision_creada', 'comision_modificada', 'comision_eliminada')`);
        await queryRunner.query(`ALTER TABLE "auditoria" ALTER COLUMN "tipoAccion" TYPE "public"."tipo_accion_enum_old" USING "tipoAccion"::"text"::"public"."tipo_accion_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."tipo_accion_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tipo_accion_enum_old" RENAME TO "tipo_accion_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."prepagos_guardados_estado_enum_old" AS ENUM('activa', 'utilizada', 'vencida', 'cancelada')`);
        await queryRunner.query(`ALTER TABLE "prepagos_guardados" ALTER COLUMN "estado" TYPE "public"."prepagos_guardados_estado_enum_old" USING "estado"::"text"::"public"."prepagos_guardados_estado_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."prepagos_guardados_estado_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."prepagos_guardados_estado_enum_old" RENAME TO "prepagos_guardados_estado_enum"`);
    }

}
