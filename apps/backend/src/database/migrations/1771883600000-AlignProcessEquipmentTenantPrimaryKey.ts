import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignProcessEquipmentTenantPrimaryKey1771883600000 implements MigrationInterface {
  name = 'AlignProcessEquipmentTenantPrimaryKey1771883600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "PROCESS_EQUIPMENTS" pe
      SET
        "COMPANY" = COALESCE("COMPANY", (
          SELECT pm."COMPANY"
          FROM "PROCESS_MASTERS" pm
          WHERE pm."PROCESS_CODE" = pe."PROCESS_CODE"
            AND ROWNUM = 1
        )),
        "PLANT_CD" = COALESCE("PLANT_CD", (
          SELECT pm."PLANT_CD"
          FROM "PROCESS_MASTERS" pm
          WHERE pm."PROCESS_CODE" = pe."PROCESS_CODE"
            AND ROWNUM = 1
        ))
    `);
    await queryRunner.query(`
      UPDATE "PROCESS_EQUIPMENTS"
      SET "COMPANY" = COALESCE("COMPANY", '-'),
          "PLANT_CD" = COALESCE("PLANT_CD", '-')
    `);
    await this.dropPrimaryKey(queryRunner);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" MODIFY ("COMPANY" NOT NULL)`);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" MODIFY ("PLANT_CD" NOT NULL)`);
    await queryRunner.query(`
      ALTER TABLE "PROCESS_EQUIPMENTS"
      ADD CONSTRAINT "PK_PROCESS_EQUIPMENTS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "PROCESS_CODE", "EQUIP_CODE")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropPrimaryKey(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "PROCESS_EQUIPMENTS"
      ADD CONSTRAINT "PK_PROCESS_EQUIPMENTS"
      PRIMARY KEY ("PROCESS_CODE", "EQUIP_CODE")
    `);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" MODIFY ("PLANT_CD" NULL)`);
    await queryRunner.query(`ALTER TABLE "PROCESS_EQUIPMENTS" MODIFY ("COMPANY" NULL)`);
  }

  private async dropPrimaryKey(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DECLARE
        v_constraint_name USER_CONSTRAINTS.CONSTRAINT_NAME%TYPE;
      BEGIN
        SELECT CONSTRAINT_NAME
        INTO v_constraint_name
        FROM USER_CONSTRAINTS
        WHERE TABLE_NAME = 'PROCESS_EQUIPMENTS'
          AND CONSTRAINT_TYPE = 'P';

        EXECUTE IMMEDIATE 'ALTER TABLE "PROCESS_EQUIPMENTS" DROP CONSTRAINT "' || v_constraint_name || '"';
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
      END;
    `);
  }
}
