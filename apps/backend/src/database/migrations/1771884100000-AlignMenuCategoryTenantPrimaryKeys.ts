import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignMenuCategoryTenantPrimaryKeys1771884100000 implements MigrationInterface {
  name = 'AlignMenuCategoryTenantPrimaryKeys1771884100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['MENU_CATEGORIES', 'MENU_CATEGORY_ITEMS']) {
      await this.ensureColumn(queryRunner, tableName, 'COMPANY', 'VARCHAR2(20)');
      await this.ensureColumn(queryRunner, tableName, 'PLANT_CD', 'VARCHAR2(20)');
    }

    await queryRunner.query(`
      UPDATE "MENU_CATEGORIES"
      SET "COMPANY" = COALESCE("COMPANY", 'HANES'),
          "PLANT_CD" = COALESCE("PLANT_CD", 'P01')
    `);
    await queryRunner.query(`
      UPDATE "MENU_CATEGORY_ITEMS" i
      SET i."COMPANY" = COALESCE(
            i."COMPANY",
            (SELECT c."COMPANY" FROM "MENU_CATEGORIES" c WHERE c."CATEGORY_CODE" = i."CATEGORY_CODE" AND ROWNUM = 1),
            'HANES'
          ),
          i."PLANT_CD" = COALESCE(
            i."PLANT_CD",
            (SELECT c."PLANT_CD" FROM "MENU_CATEGORIES" c WHERE c."CATEGORY_CODE" = i."CATEGORY_CODE" AND ROWNUM = 1),
            'P01'
          )
    `);

    await this.dropForeignKeys(queryRunner, 'MENU_CATEGORY_ITEMS');

    for (const tableName of ['MENU_CATEGORY_ITEMS', 'MENU_CATEGORIES']) {
      await this.dropPrimaryKey(queryRunner, tableName);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("COMPANY" NOT NULL)`);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("PLANT_CD" NOT NULL)`);
    }

    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORIES"
      ADD CONSTRAINT "PK_MENU_CATEGORIES"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "CATEGORY_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORY_ITEMS"
      ADD CONSTRAINT "PK_MENU_CATEGORY_ITEMS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORY_ITEMS"
      ADD CONSTRAINT "FK_MENU_CATEGORY_ITEMS_CATEGORY"
      FOREIGN KEY ("COMPANY", "PLANT_CD", "CATEGORY_CODE")
      REFERENCES "MENU_CATEGORIES" ("COMPANY", "PLANT_CD", "CATEGORY_CODE")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner, 'MENU_CATEGORY_ITEMS');

    for (const tableName of ['MENU_CATEGORY_ITEMS', 'MENU_CATEGORIES']) {
      await this.dropPrimaryKey(queryRunner, tableName);
    }

    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORIES"
      ADD CONSTRAINT "PK_MENU_CATEGORIES"
      PRIMARY KEY ("CATEGORY_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORY_ITEMS"
      ADD CONSTRAINT "PK_MENU_CATEGORY_ITEMS"
      PRIMARY KEY ("MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "MENU_CATEGORY_ITEMS"
      ADD CONSTRAINT "FK_MENU_CATEGORY_ITEMS_CATEGORY"
      FOREIGN KEY ("CATEGORY_CODE")
      REFERENCES "MENU_CATEGORIES" ("CATEGORY_CODE")
      ON DELETE CASCADE
    `);
  }

  private async ensureColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    columnType: string,
  ): Promise<void> {
    await queryRunner.query(`
      DECLARE
        v_count NUMBER;
      BEGIN
        SELECT COUNT(*)
        INTO v_count
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = '${tableName}'
          AND COLUMN_NAME = '${columnName}';

        IF v_count = 0 THEN
          EXECUTE IMMEDIATE 'ALTER TABLE "${tableName}" ADD ("${columnName}" ${columnType})';
        END IF;
      END;
    `);
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

  private async dropForeignKeys(queryRunner: QueryRunner, tableName: string): Promise<void> {
    await queryRunner.query(`
      BEGIN
        FOR c IN (
          SELECT CONSTRAINT_NAME
          FROM USER_CONSTRAINTS
          WHERE TABLE_NAME = '${tableName}'
            AND CONSTRAINT_TYPE = 'R'
        ) LOOP
          EXECUTE IMMEDIATE 'ALTER TABLE "${tableName}" DROP CONSTRAINT "' || c.CONSTRAINT_NAME || '"';
        END LOOP;
      END;
    `);
  }
}
