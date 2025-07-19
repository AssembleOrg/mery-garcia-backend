import { MigrationInterface, QueryRunner } from "typeorm";

export class InitAll1754095300000 implements MigrationInterface {
  name = "InitAll1754095300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Base / Extensiones ---
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // --- ENUMs (idempotentes) ---
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."rol_personal_enum" AS ENUM('admin', 'user', 'encargado');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."prepagos_guardados_moneda_enum" AS ENUM('ARS', 'USD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."prepagos_guardados_estado_enum" AS ENUM('ACTIVO', 'UTILIZADO', 'VENCIDO', 'CANCELADO');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."metodos_pago_tipo_enum" AS ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."metodos_pago_moneda_enum" AS ENUM('ARS', 'USD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."comandas_caja_enum" AS ENUM('caja_1', 'caja_2');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."comandas_tipodecomanda_enum" AS ENUM('INGRESO', 'EGRESO');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."comandas_estadodecomanda_enum" AS ENUM('PENDIENTE', 'PAGADA', 'CANCELADA', 'FINALIZADA', 'TRASPASADA', 'VALIDADO');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."productos_servicios_tipo_enum" AS ENUM('PRODUCTO', 'SERVICIO');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."rol_trabajador_enum" AS ENUM('TRABAJADOR', 'ENCARGADO', 'VENDEDOR');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."prepagos_moneda_enum" AS ENUM('ARS', 'USD');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tipo_accion_enum" AS ENUM('CREAR', 'ACTUALIZAR', 'ELIMINAR', 'RESTAURAR', 'LOGIN', 'LOGOUT', 'COMANDAMODIFICADA');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."modulo_sistema_enum" AS ENUM('AUTH', 'PERSONAL', 'CLIENTE', 'COMANDA', 'AUDITORIA', 'CONFIG');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // --- Tablas (sin FKs primero) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "movimientos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "monto" numeric(12,4) NOT NULL DEFAULT '0',
        "residual" numeric(12,4) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "comandaId" uuid NOT NULL,
        "personalId" uuid,
        CONSTRAINT "PK_519702aa97def3e7c1b6cc5e2f9" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "personal" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(100) NOT NULL,
        "email" character varying(100) NOT NULL,
        "password" character varying(255) NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        "rol" "public"."rol_personal_enum" NOT NULL DEFAULT 'user',
        "fechaIngreso" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_70d5093c89e28f09e712a6ab572" UNIQUE ("email"),
        CONSTRAINT "PK_7a849a61cdfe8eee39892d7b1b1" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prepagos_guardados" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "monto" numeric(12,2) NOT NULL DEFAULT '0',
        "moneda" "public"."prepagos_guardados_moneda_enum" NOT NULL,
        "fechaCreacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "fechaVencimiento" TIMESTAMP WITH TIME ZONE,
        "estado" "public"."prepagos_guardados_estado_enum" NOT NULL,
        "observaciones" character varying NOT NULL DEFAULT '',
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "cliente_id" uuid,
        CONSTRAINT "PK_ffb59a7b777c19dabe9b7239313" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clientes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cuit" character varying(20),
        "nombre" character varying(100) NOT NULL,
        "telefono" character varying NOT NULL DEFAULT '',
        "email" character varying NOT NULL DEFAULT '',
        "fechaRegistro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "comentarios" text,
        CONSTRAINT "UQ_4e4e45a41c5515a2be18332550e" UNIQUE ("cuit"),
        CONSTRAINT "PK_d76bf3571d906e4e86470482c08" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "metodos_pago" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tipo" "public"."metodos_pago_tipo_enum" NOT NULL,
        "monto" numeric(12,2) NOT NULL DEFAULT '0',
        "recargo_porcentaje" numeric(5,2) NOT NULL DEFAULT '0',
        "descuento_global_porcentaje" numeric(5,2) NOT NULL DEFAULT '0',
        "monto_final" numeric(12,2) NOT NULL DEFAULT '0',
        "moneda" "public"."metodos_pago_moneda_enum" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "comandaId" uuid,
        CONSTRAINT "PK_f0a766e84c240f201c5cd87c286" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "descuentos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(100) NOT NULL,
        "descripcion" text,
        "porcentaje" numeric(5,2) NOT NULL DEFAULT '0',
        "montoFijo" numeric(12,2) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "comandaId" uuid NOT NULL,
        CONSTRAINT "PK_720a8b3056b8ac5255e72c46cac" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "egreso" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "total" numeric(12,4) NOT NULL DEFAULT '0',
        "totalDolar" numeric(12,4) NOT NULL DEFAULT '0',
        "totalPesos" numeric(12,4) NOT NULL DEFAULT '0',
        "valorDolar" numeric(12,4) NOT NULL DEFAULT '0',
        "moneda" character varying(3) NOT NULL,
        "comandaId" uuid,
        CONSTRAINT "PK_48ce934d89f73b0f457bd57a8fb" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comandas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "numero" character varying(30) NOT NULL,
        "caja" "public"."comandas_caja_enum" NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL,
        "tipoDeComanda" "public"."comandas_tipodecomanda_enum" NOT NULL,
        "estadoDeComanda" "public"."comandas_estadodecomanda_enum" NOT NULL,
        "usuarioConsumePrepago" boolean NOT NULL DEFAULT false,
        "precioDolar" numeric(12,4) NOT NULL DEFAULT '0',
        "precioPesos" numeric(12,4) NOT NULL DEFAULT '0',
        "valorDolar" numeric(12,4) NOT NULL DEFAULT '0',
        "observaciones" text,
        "creadoPorId" uuid NOT NULL,
        "clienteId" uuid,
        CONSTRAINT "PK_f2a79c4679e1b8f6342d758f964" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tipos_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(100) NOT NULL,
        "descripcion" character varying(255),
        "activo" boolean NOT NULL DEFAULT true,
        "orden" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_d3c836259e6c5a17a696a9e5541" UNIQUE ("nombre"),
        CONSTRAINT "PK_e254b4c6964dd95099683a1f172" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unidades_negocio" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(100) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_0afe6e5695267e94b37461d1c8f" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "productos_servicios" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(150) NOT NULL,
        "precio" numeric(12,4) NOT NULL DEFAULT '0',
        "tipo" "public"."productos_servicios_tipo_enum" NOT NULL,
        "descripcion" text,
        "activo" boolean NOT NULL DEFAULT true,
        "duracion" integer,
        "codigoBarras" character varying(50),
        "esPrecioCongelado" boolean NOT NULL DEFAULT false,
        "precioFijoARS" numeric(12,4),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL,
        "unidadNegocioId" uuid NOT NULL,
        CONSTRAINT "PK_1e53fea06036ab53240f69302ea" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "item_comanda" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(150) NOT NULL,
        "precio" numeric(12,2) NOT NULL DEFAULT '0',
        "cantidad" integer NOT NULL DEFAULT '1',
        "descuento" numeric(12,2) NOT NULL DEFAULT '0',
        "subtotal" numeric(12,2) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "producto_servicio_id" uuid,
        "tipo_id" uuid,
        "comanda_id" uuid,
        "trabajador_id" uuid,
        CONSTRAINT "PK_8728bb62f38e703782a25a9a7cb" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trabajadores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(100) NOT NULL,
        "rol" "public"."rol_trabajador_enum" NOT NULL DEFAULT 'TRABAJADOR',
        "comisionPorcentaje" numeric(5,2) NOT NULL DEFAULT '0',
        "telefono" character varying(20),
        "activo" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_572c7e550b3d755a9826d4a5daa" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prepagos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "monto" numeric(12,2) NOT NULL DEFAULT '0',
        "moneda" "public"."prepagos_moneda_enum" NOT NULL,
        "fecha" TIMESTAMP WITH TIME ZONE NOT NULL,
        "observaciones" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_9b7cf5c685f190da9961dd97464" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cotizaciones_dolar" (
        "id" SERIAL NOT NULL,
        "compra" numeric(10,2) NOT NULL,
        "venta" numeric(10,2) NOT NULL,
        "casa" character varying(100) NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "moneda" character varying(10) NOT NULL DEFAULT 'USD',
        "fechaActualizacion" TIMESTAMP NOT NULL,
        "fuente" character varying(50) NOT NULL DEFAULT 'API',
        "observaciones" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_b842f06dec2379d6f04ad4ecd49" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "configuraciones_sistema" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clave" character varying(100) NOT NULL,
        "valor" text NOT NULL,
        "descripcion" character varying(255),
        "activo" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_ffcb466ee6c9b2591b9dc6b7f3b" UNIQUE ("clave"),
        CONSTRAINT "PK_525270e38851bf0ce7434f9cfd7" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auditoria" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tipoAccion" "public"."tipo_accion_enum" NOT NULL,
        "modulo" "public"."modulo_sistema_enum" NOT NULL,
        "descripcion" character varying(255) NOT NULL,
        "datosAnteriores" jsonb,
        "datosNuevos" jsonb,
        "observaciones" character varying(500),
        "ipAddress" character varying(45),
        "userAgent" character varying(255),
        "entidadId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "usuario_id" uuid,
        CONSTRAINT "PK_135fe98308816fe3a2d458e6637" PRIMARY KEY ("id")
      );
    `);

    // --- Índices únicos (idempotentes) ---
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f6109a27319264e8e7f984b74d" ON "comandas" ("numero");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_1676865266399fd4061ef14b49" ON "unidades_negocio" ("nombre");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_23642f80edc8b13708b83530e2"
      ON "productos_servicios" ("codigoBarras")
      WHERE "codigoBarras" IS NOT NULL;
    `);

    // --- Foreign Keys (solo si no existen) ---
    // Helper: función para agregar FK si no existe
    const addFkIfNotExists = async (
      table: string,
      constraint: string,
      fkSql: string
    ) => {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = '${constraint}'
          ) THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" ${fkSql};
          END IF;
        END $$;
      `);
    };

    await addFkIfNotExists("movimientos", "FK_42425be9429daef9f5718e3168b",
      `FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await addFkIfNotExists("movimientos", "FK_86d64f5d291403dd1d55b5872c5",
      `FOREIGN KEY ("personalId") REFERENCES "personal"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await addFkIfNotExists("prepagos_guardados", "FK_5bc0ab56327fa086edadeac937a",
      `FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    await addFkIfNotExists("metodos_pago", "FK_2404d3719ceedf7ed45fc41a4d0",
      `FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await addFkIfNotExists("descuentos", "FK_0dc7d23e0eaf40242b0774e9634",
      `FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await addFkIfNotExists("egreso", "FK_bbf88b076cb07fed4d7e414f6cc",
      `FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    await addFkIfNotExists("comandas", "FK_dbd101c68a66859746a3e33a46a",
      `FOREIGN KEY ("creadoPorId") REFERENCES "personal"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await addFkIfNotExists("comandas", "FK_7f075e9a5fb43047f0b86c52142",
      `FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await addFkIfNotExists("productos_servicios", "FK_6bed831b72afdab63fc7fa98aec",
      `FOREIGN KEY ("unidadNegocioId") REFERENCES "unidades_negocio"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

    await addFkIfNotExists("item_comanda", "FK_8fe3ed7a88db2082c901b603623",
      `FOREIGN KEY ("producto_servicio_id") REFERENCES "productos_servicios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await addFkIfNotExists("item_comanda", "FK_db6e5bbba92cf6dac01156184d0",
      `FOREIGN KEY ("tipo_id") REFERENCES "tipos_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await addFkIfNotExists("item_comanda", "FK_18982a39318addde0a94de5f760",
      `FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await addFkIfNotExists("item_comanda", "FK_5d5364b71d102b34bd3984c3f40",
      `FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    await addFkIfNotExists("auditoria", "FK_e3351946be53c7cd3286ed4c49d",
      `FOREIGN KEY ("usuario_id") REFERENCES "personal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Bajar en orden inverso (tablas primero; CASCADE para soltar FKs/índices)
    await queryRunner.query(`DROP TABLE IF EXISTS "auditoria" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "configuraciones_sistema" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cotizaciones_dolar" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prepagos" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trabajadores" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "item_comanda" CASCADE;`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_23642f80edc8b13708b83530e2";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "productos_servicios" CASCADE;`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_1676865266399fd4061ef14b49";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "unidades_negocio" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tipos_item" CASCADE;`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_f6109a27319264e8e7f984b74d";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comandas" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "egreso" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "descuentos" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "metodos_pago" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clientes" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prepagos_guardados" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "personal" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "movimientos" CASCADE;`);

    // Enums al final (idempotente)
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."modulo_sistema_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tipo_accion_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prepagos_moneda_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rol_trabajador_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."productos_servicios_tipo_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."comandas_estadodecomanda_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."comandas_tipodecomanda_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."comandas_caja_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."metodos_pago_moneda_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."metodos_pago_tipo_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prepagos_guardados_estado_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."prepagos_guardados_moneda_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rol_personal_enum";`);
    // La extensión no la dropeo por seguridad (puede estar siendo usada por otras tablas)
  }
}
