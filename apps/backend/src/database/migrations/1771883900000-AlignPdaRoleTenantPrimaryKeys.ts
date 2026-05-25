import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignPdaRoleTenantPrimaryKeys1771883900000 implements MigrationInterface {
  name = 'AlignPdaRoleTenantPrimaryKeys1771883900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['PDA_ROLE', 'PDA_ROLE_MENU']) {
      await this.ensureColumn(queryRunner, tableName, 'COMPANY', 'VARCHAR2(50)');
      await this.ensureColumn(queryRunner, tableName, 'PLANT_CD', 'VARCHAR2(50)');
    }

    await queryRunner.query(`
      UPDATE "PDA_ROLE"
      SET "COMPANY" = COALESCE("COMPANY", 'HANES'),
          "PLANT_CD" = COALESCE("PLANT_CD", 'P01')
    `);
    await queryRunner.query(`
      UPDATE "PDA_ROLE_MENU" m
      SET m."COMPANY" = COALESCE(
            m."COMPANY",
            (SELECT r."COMPANY" FROM "PDA_ROLE" r WHERE r."CODE" = m."PDA_ROLE_CODE" AND ROWNUM = 1),
            'HANES'
          ),
          m."PLANT_CD" = COALESCE(
            m."PLANT_CD",
            (SELECT r."PLANT_CD" FROM "PDA_ROLE" r WHERE r."CODE" = m."PDA_ROLE_CODE" AND ROWNUM = 1),
            'P01'
          )
    `);

    await this.dropForeignKeys(queryRunner, 'PDA_ROLE_MENU');

    for (const tableName of ['PDA_ROLE_MENU', 'PDA_ROLE']) {
      await this.dropPrimaryKey(queryRunner, tableName);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("COMPANY" NOT NULL)`);
      await queryRunner.query(`ALTER TABLE "${tableName}" MODIFY ("PLANT_CD" NOT NULL)`);
    }

    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE"
      ADD CONSTRAINT "PK_PDA_ROLE"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE_MENU"
      ADD CONSTRAINT "PK_PDA_ROLE_MENU"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "PDA_ROLE_CODE", "MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE_MENU"
      ADD CONSTRAINT "FK_PDA_ROLE_MENU_ROLE"
      FOREIGN KEY ("COMPANY", "PLANT_CD", "PDA_ROLE_CODE")
      REFERENCES "PDA_ROLE" ("COMPANY", "PLANT_CD", "CODE")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner, 'PDA_ROLE_MENU');

    for (const tableName of ['PDA_ROLE_MENU', 'PDA_ROLE']) {
      await this.dropPrimaryKey(queryRunner, tableName);
    }

    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE"
      ADD CONSTRAINT "PK_PDA_ROLE"
      PRIMARY KEY ("CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE_MENU"
      ADD CONSTRAINT "PK_PDA_ROLE_MENU"
      PRIMARY KEY ("PDA_ROLE_CODE", "MENU_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "PDA_ROLE_MENU"
      ADD CONSTRAINT "FK_PDA_ROLE_MENU_ROLE"
      FOREIGN KEY ("PDA_ROLE_CODE")
      REFERENCES "PDA_ROLE" ("CODE")
      ON DELETE CASCADE
    `);

    for (const tableName of ['PDA_ROLE_MENU', 'PDA_ROLE']) {
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
