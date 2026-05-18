import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBomRoutingCode1771883200000 implements MigrationInterface {
  name = 'DropBomRoutingCode1771883200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DECLARE
        v_count NUMBER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM USER_INDEXES
        WHERE INDEX_NAME = 'IDX_BOM_MASTERS_ROUTING';

        IF v_count > 0 THEN
          EXECUTE IMMEDIATE 'DROP INDEX IDX_BOM_MASTERS_ROUTING';
        END IF;

        SELECT COUNT(*) INTO v_count
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = 'BOM_MASTERS'
          AND COLUMN_NAME = 'ROUTING_CODE';

        IF v_count > 0 THEN
          EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS DROP COLUMN ROUTING_CODE';
        END IF;
      END;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DECLARE
        v_count NUMBER;
      BEGIN
        SELECT COUNT(*) INTO v_count
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = 'BOM_MASTERS'
          AND COLUMN_NAME = 'ROUTING_CODE';

        IF v_count = 0 THEN
          EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS ADD ROUTING_CODE VARCHAR2(50)';
        END IF;

        SELECT COUNT(*) INTO v_count
        FROM USER_INDEXES
        WHERE INDEX_NAME = 'IDX_BOM_MASTERS_ROUTING';

        IF v_count = 0 THEN
          EXECUTE IMMEDIATE 'CREATE INDEX IDX_BOM_MASTERS_ROUTING ON BOM_MASTERS (ROUTING_CODE)';
        END IF;
      END;
    `);
  }
}
