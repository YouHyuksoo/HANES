import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoutingMaterials1771883300000 implements MigrationInterface {
  name = 'CreateRoutingMaterials1771883300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ROUTING_MATERIALS (
        ROUTING_CODE VARCHAR2(50) NOT NULL,
        SEQ NUMBER(10) NOT NULL,
        CHILD_ITEM_CODE VARCHAR2(50) NOT NULL,
        ALLOC_QTY NUMBER(10,4) DEFAULT 0 NOT NULL,
        ISSUE_METHOD VARCHAR2(20) DEFAULT 'BACKFLUSH' NOT NULL,
        USE_YN CHAR(1) DEFAULT 'Y' NOT NULL,
        COMPANY VARCHAR2(50) NOT NULL,
        PLANT_CD VARCHAR2(50) NOT NULL,
        CREATED_BY VARCHAR2(50),
        UPDATED_BY VARCHAR2(50),
        CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT PK_ROUTING_MATERIALS PRIMARY KEY (ROUTING_CODE, SEQ, CHILD_ITEM_CODE)
      )
    `);
    await queryRunner.query(`CREATE INDEX IDX_ROUTING_MATERIALS_PROC ON ROUTING_MATERIALS (ROUTING_CODE, SEQ)`);
    await queryRunner.query(`CREATE INDEX IDX_ROUTING_MATERIALS_CHILD ON ROUTING_MATERIALS (CHILD_ITEM_CODE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE ROUTING_MATERIALS`);
  }
}
