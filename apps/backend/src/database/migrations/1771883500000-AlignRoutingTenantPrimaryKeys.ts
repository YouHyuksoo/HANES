import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignRoutingTenantPrimaryKeys1771883500000 implements MigrationInterface {
  name = 'AlignRoutingTenantPrimaryKeys1771883500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropPrimaryKey(queryRunner, 'PROCESS_QUALITY_CONDITIONS');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_MATERIALS');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_PROCESSES');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_GROUPS');

    await queryRunner.query(`
      ALTER TABLE "ROUTING_GROUPS"
      ADD CONSTRAINT "PK_ROUTING_GROUPS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "ROUTING_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROUTING_PROCESSES"
      ADD CONSTRAINT "PK_ROUTING_PROCESSES"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ")
    `);
    await queryRunner.query(`
      ALTER TABLE "PROCESS_QUALITY_CONDITIONS"
      ADD CONSTRAINT "PK_PROCESS_QUALITY_COND"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ", "CONDITION_SEQ")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROUTING_MATERIALS"
      ADD CONSTRAINT "PK_ROUTING_MATERIALS"
      PRIMARY KEY ("COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ", "CHILD_ITEM_CODE")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropPrimaryKey(queryRunner, 'PROCESS_QUALITY_CONDITIONS');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_MATERIALS');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_PROCESSES');
    await this.dropPrimaryKey(queryRunner, 'ROUTING_GROUPS');

    await queryRunner.query(`
      ALTER TABLE "ROUTING_GROUPS"
      ADD CONSTRAINT "PK_ROUTING_GROUPS"
      PRIMARY KEY ("ROUTING_CODE")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROUTING_PROCESSES"
      ADD CONSTRAINT "PK_ROUTING_PROCESSES"
      PRIMARY KEY ("ROUTING_CODE", "SEQ")
    `);
    await queryRunner.query(`
      ALTER TABLE "PROCESS_QUALITY_CONDITIONS"
      ADD CONSTRAINT "PK_PROCESS_QUALITY_COND"
      PRIMARY KEY ("ROUTING_CODE", "SEQ", "CONDITION_SEQ")
    `);
    await queryRunner.query(`
      ALTER TABLE "ROUTING_MATERIALS"
      ADD CONSTRAINT "PK_ROUTING_MATERIALS"
      PRIMARY KEY ("ROUTING_CODE", "SEQ", "CHILD_ITEM_CODE")
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
}
