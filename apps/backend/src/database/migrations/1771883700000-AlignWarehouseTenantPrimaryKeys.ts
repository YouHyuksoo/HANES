import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignWarehouseTenantPrimaryKeys1771883700000 implements MigrationInterface {
  name = 'AlignWarehouseTenantPrimaryKeys1771883700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['WAREHOUSE_TRANSFER_RULES', 'WAREHOUSE_LOCATIONS', 'WAREHOUSES']) {
      await queryRunner.query(`
        UPDATE "${tableName}"
        SET "COMPANY" = COALESCE("COMPANY", '-'),
            "PLANT_CD" = COALESCE("PLANT_CD", '-')
      `);
      await this.dropPrimaryKey(queryRunner, tableName);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("COMPANY" NOT NULL)`);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("PLANT_CD" NOT NULL)`);
    }

    await queryRunner.query(`
      ALTER TABLE "WAREHOUSES"
      ADD CONSTRAINT "PK_WAREHOUSES"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "WAREHOUSE_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "WAREHOUSE_LOCATIONS"
      ADD CONSTRAINT "PK_WAREHOUSE_LOCATIONS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "LOCATION_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "WAREHOUSE_TRANSFER_RULES"
      ADD CONSTRAINT "PK_WAREHOUSE_TRANSFER_RULES"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "FROM_WAREHOUSE_ID", "TO_WAREHOUSE_ID")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['WAREHOUSE_TRANSFER_RULES', 'WAREHOUSE_LOCATIONS', 'WAREHOUSES']) {
      await this.dropPrimaryKey(queryRunner, tableName);
    }

    await queryRunner.query(`
      ALTER TABLE "WAREHOUSES"
      ADD CONSTRAINT "PK_WAREHOUSES"
      PRIMARY KEY ("WAREHOUSE_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "WAREHOUSE_LOCATIONS"
      ADD CONSTRAINT "PK_WAREHOUSE_LOCATIONS"
      PRIMARY KEY ("WAREHOUSE_CODE", "LOCATION_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "WAREHOUSE_TRANSFER_RULES"
      ADD CONSTRAINT "PK_WAREHOUSE_TRANSFER_RULES"
      PRIMARY KEY ("FROM_WAREHOUSE_ID", "TO_WAREHOUSE_ID")
    `);

    for (const tableName of ['WAREHOUSE_TRANSFER_RULES', 'WAREHOUSE_LOCATIONS', 'WAREHOUSES']) {
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("PLANT_CD" NULL)`);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("COMPANY" NULL)`);
    }
  }

  private async dropPrimaryKey(queryRunner: QueryRunner, tableName: string): Promise<void> {
    await queryRunner.query(`
      DECLARE
        v_constraint_name USER_CONSTRAINTS.CONSTRAINT_NAME%TYPE;
      BEGIN
        SELECT CONSTRAINT_NAME
        INTO v_constraint_name
        FROM USER_CONSTRAINTS
        WHERE TABLE_NAME = '${tableName}'
          AND CONSTRAINT_TYPE = 'P';

        EXECUTE IMMEDIATE 'ALTER TABLE "${tableName}" DROP CONSTRAINT "' || v_constraint_name || '"';
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
      END;
    `);
  }
}
