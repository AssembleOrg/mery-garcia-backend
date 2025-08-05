import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUniqueIndexFromComandaNumero1754475553000 implements MigrationInterface {
  name = 'RemoveUniqueIndexFromComandaNumero1754475553000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el índice único del campo numero en la tabla comandas
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_f6109a27319264e8e7f984b74d"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recrear el índice único en caso de rollback
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6109a27319264e8e7f984b74d" ON "comandas" ("numero")`);
  }
}
