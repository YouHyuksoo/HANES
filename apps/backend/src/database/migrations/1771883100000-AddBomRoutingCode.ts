import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBomRoutingCode1771883100000 implements MigrationInterface {
  name = 'AddBomRoutingCode1771883100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "BOM_MASTERS"
      ADD "ROUTING_CODE" VARCHAR2(50)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_BOM_MASTERS_ROUTING" ON "BOM_MASTERS" ("ROUTING_CODE")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_BOM_MASTERS_ROUTING"`);
    await queryRunner.query(`ALTER TABLE "BOM_MASTERS" DROP COLUMN "ROUTING_CODE"`);
  }
}
