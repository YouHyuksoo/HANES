import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantToProcessEquipments1771883400000 implements MigrationInterface {
  name = 'AddTenantToProcessEquipments1771883400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "PROCESS_EQUIPMENTS" ADD (
        "COMPANY" VARCHAR2(50),
        "PLANT_CD" VARCHAR2(50)
      )
    `);
    await queryRunner.query(`
      UPDATE "PROCESS_EQUIPMENTS" pe
      SET
        "COMPANY" = (
          SELECT pm."COMPANY"
          FROM "PROCESS_MASTERS" pm
          WHERE pm."PROCESS_CODE" = pe."PROCESS_CODE"
            AND ROWNUM = 1
        ),
        "PLANT_CD" = (
          SELECT pm."PLANT_CD"
          FROM "PROCESS_MASTERS" pm
          WHERE pm."PROCESS_CODE" = pe."PROCESS_CODE"
            AND ROWNUM = 1
        )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_PROCESS_EQUIP_TENANT" ON "PROCESS_EQUIPMENTS" ("COMPANY", "PLANT_CD")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_PROCESS_EQUIP_TENANT"`);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" DROP COLUMN "PLANT_CD"`);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" DROP COLUMN "COMPANY"`);
  }
}
