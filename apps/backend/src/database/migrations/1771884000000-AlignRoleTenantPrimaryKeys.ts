import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignRoleTenantPrimaryKeys1771884000000 implements MigrationInterface {
  name = 'AlignRoleTenantPrimaryKeys1771884000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['ROLES', 'ROLE_MENU_PERMISSIONS']) {
      await this.ensureColumn(queryRunner, tableName, 'COMPANY', 'VARCHAR2(50)');
      await this.ensureColumn(queryRunner, tableName, 'PLANT_CD', 'VARCHAR2(50)');
    }

    await queryRunner.query(`
      UPDATE "ROLES"
      SET "COMPANY" = COALESCE("COMPANY", 'HANES'),
          "PLANT_CD" = COALESCE("PLANT_CD", 'P01')
    `);
    await queryRunner.query(`
      UPDATE "ROLE_MENU_PERMISSIONS" p
      SET p."COMPANY" = COALESCE(
            p."COMPANY",
            (SELECT r."COMPANY" FROM "ROLES" r WHERE r."CODE" = p."ROLE_CODE" AND ROWNUM = 1),
            'HANES'
          ),
          p."PLANT_CD" = COALESCE(
            p."PLANT_CD",
            (SELECT r."PLANT_CD" FROM "ROLES" r WHERE r."CODE" = p."ROLE_CODE" AND ROWNUM = 1),
            'P01'
          )
    `);

    await this.dropForeignKeys(queryRunner, 'ROLE_MENU_PERMISSIONS');

    for (const tableName of ['ROLE_MENU_PERMISSIONS', 'ROLES']) {
      await this.dropPrimaryKey(queryRunner, tableName);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("COMPANY" NOT NULL)`);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("PLANT_CD" NOT NULL)`);
    }

    await queryRunner.query(`
      ALTER TABLE "ROLES"
      ADD CONSTRAINT "PK_ROLES"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROLE_MENU_PERMISSIONS"
      ADD CONSTRAINT "PK_ROLE_MENU_PERMISSIONS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "ROLE_CODE", "MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROLE_MENU_PERMISSIONS"
      ADD CONSTRAINT "FK_ROLE_MENU_PERMISSIONS_ROLE"
      FOREIGN KEY ("COMPANY", "PLANT_CD", "ROLE_CODE")
      REFERENCES "ROLES" ("COMPANY", "PLANT_CD", "CODE")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner, 'ROLE_MENU_PERMISSIONS');

    for (const tableName of ['ROLE_MENU_PERMISSIONS', 'ROLES']) {
      await this.dropPrimaryKey(queryRunner, tableName);
    }

    await queryRunner.query(`
      ALTER TABLE "ROLES"
      ADD CONSTRAINT "PK_ROLES"
      PRIMARY KEY ("CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROLE_MENU_PERMISSIONS"
      ADD CONSTRAINT "PK_ROLE_MENU_PERMISSIONS"
      PRIMARY KEY ("ROLE_CODE", "MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROLE_MENU_PERMISSIONS"
      ADD CONSTRAINT "FK_ROLE_MENU_PERMISSIONS_ROLE"
      FOREIGN KEY ("ROLE_CODE")
      REFERENCES "ROLES" ("CODE")
      ON DELETE CASCADE
    `);

    for (const tableName of ['ROLE_MENU_PERMISSIONS', 'ROLES']) {
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
