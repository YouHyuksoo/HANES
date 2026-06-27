/**
 * @file 1771889000000-CreateProcMatStock.ts
 * @description 공정재고(장착 대기) 테이블 PROC_MAT_STOCKS + 수불 원장 PROC_MAT_TRANSACTIONS 생성 (ADR 0002).
 *
 * 자재 흐름: 원자재창고 → [출고] → 공정재고(PROC_MAT_STOCKS) → [설비 장착] → 설비재고(WIP_MAT_STOCKS) → 차감.
 * 공정재고는 공정(PROCESS_CODE) 단위, 작업지시 무관 공용. 감사컬럼은 DEFAULT SYSTIMESTAMP(Oracle 필수).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcMatStock1771889000000 implements MigrationInterface {
  name = 'CreateProcMatStock1771889000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "PROC_MAT_STOCKS" (
        "COMPANY" VARCHAR2(50) NOT NULL,
        "PLANT_CD" VARCHAR2(50) NOT NULL,
        "PROCESS_CODE" VARCHAR2(50) NOT NULL,
        "ITEM_CODE" VARCHAR2(50) NOT NULL,
        "MAT_UID" VARCHAR2(100) NOT NULL,
        "QTY" NUMBER DEFAULT 0,
        "AVAILABLE_QTY" NUMBER DEFAULT 0,
        "RESERVED_QTY" NUMBER DEFAULT 0,
        "CREATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        "UPDATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT "PK_PROC_MAT_STOCKS" PRIMARY KEY ("COMPANY","PLANT_CD","PROCESS_CODE","ITEM_CODE","MAT_UID")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_PROC_MAT_STOCKS_PROC" ON "PROC_MAT_STOCKS" ("PROCESS_CODE")`);
    await queryRunner.query(`CREATE INDEX "IDX_PROC_MAT_STOCKS_ITEM" ON "PROC_MAT_STOCKS" ("ITEM_CODE")`);

    await queryRunner.query(`
      CREATE TABLE "PROC_MAT_TRANSACTIONS" (
        "TRANS_NO" VARCHAR2(50) NOT NULL,
        "TRANS_TYPE" VARCHAR2(50) NOT NULL,
        "PROCESS_CODE" VARCHAR2(50) NOT NULL,
        "ITEM_CODE" VARCHAR2(50) NOT NULL,
        "MAT_UID" VARCHAR2(100) NOT NULL,
        "QTY" NUMBER NOT NULL,
        "FROM_WAREHOUSE_ID" VARCHAR2(50),
        "EQUIP_CODE" VARCHAR2(50),
        "ORDER_NO" VARCHAR2(50),
        "REF_TYPE" VARCHAR2(50),
        "REF_ID" VARCHAR2(100),
        "CANCEL_REF_ID" VARCHAR2(50),
        "STATUS" VARCHAR2(20) DEFAULT 'DONE',
        "REMARK" VARCHAR2(500),
        "WORKER_CODE" VARCHAR2(50),
        "COMPANY" VARCHAR2(50) NOT NULL,
        "PLANT_CD" VARCHAR2(50) NOT NULL,
        "CREATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        "UPDATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT "PK_PROC_MAT_TRANSACTIONS" PRIMARY KEY ("TRANS_NO")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_PROC_MAT_TX_PROC_ITEM" ON "PROC_MAT_TRANSACTIONS" ("PROCESS_CODE","ITEM_CODE")`);
    await queryRunner.query(`CREATE INDEX "IDX_PROC_MAT_TX_REF" ON "PROC_MAT_TRANSACTIONS" ("REF_TYPE","REF_ID")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "PROC_MAT_TRANSACTIONS"`);
    await queryRunner.query(`DROP TABLE "PROC_MAT_STOCKS"`);
  }
}
