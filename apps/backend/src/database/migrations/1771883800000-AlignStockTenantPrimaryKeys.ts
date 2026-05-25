import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignStockTenantPrimaryKeys1771883800000 implements MigrationInterface {
  name = 'AlignStockTenantPrimaryKeys1771883800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['MAT_STOCKS', 'PRODUCT_STOCKS']) {
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
      ALTER TABLE "MAT_STOCKS"
      ADD CONSTRAINT "PK_MAT_STOCKS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "ITEM_CODE", "MAT_UID")
    `);
    await queryRunner.query(`
      ALTER TABLE "PRODUCT_STOCKS"
      ADD CONSTRAINT "PK_PRODUCT_STOCKS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "ITEM_CODE", "PRD_UID")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['MAT_STOCKS', 'PRODUCT_STOCKS']) {
      await this.dropPrimaryKey(queryRunner, tableName);
    }

    await queryRunner.query(`
      ALTER TABLE "MAT_STOCKS"
      ADD CONSTRAINT "PK_MAT_STOCKS"
      PRIMARY KEY ("WAREHOUSE_CODE", "ITEM_CODE", "MAT_UID")
    `);
    await queryRunner.query(`
      ALTER TABLE "PRODUCT_STOCKS"
      ADD CONSTRAINT "PK_PRODUCT_STOCKS"
      PRIMARY KEY ("WAREHOUSE_CODE", "ITEM_CODE", "PRD_UID")
    `);

    for (const tableName of ['MAT_STOCKS', 'PRODUCT_STOCKS']) {
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
