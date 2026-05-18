import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcessEquipments1771883000000 implements MigrationInterface {
  name = 'CreateProcessEquipments1771883000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "PROCESS_EQUIPMENTS" (
        "PROCESS_CODE" VARCHAR2(50) NOT NULL,
        "EQUIP_CODE" VARCHAR2(50) NOT NULL,
        "USE_YN" VARCHAR2(1) DEFAULT 'Y',
        "CREATED_BY" VARCHAR2(50),
        "UPDATED_BY" VARCHAR2(50),
        "CREATED_AT" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "UPDATED_AT" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_PROCESS_EQUIPMENTS" PRIMARY KEY ("PROCESS_CODE", "EQUIP_CODE")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_PROCESS_EQUIP_EQUIP" ON "PROCESS_EQUIPMENTS" ("EQUIP_CODE")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_PROCESS_EQUIP_EQUIP"`);
    await queryRunner.query(`DROP TABLE "PROCESS_EQUIPMENTS"`);
  }
}
