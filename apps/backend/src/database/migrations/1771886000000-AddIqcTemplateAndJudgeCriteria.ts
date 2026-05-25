/**
 * @file 1771886000000-AddIqcTemplateAndJudgeCriteria.ts
 * @description IQC 항목 템플릿 기능 — IQC_TEMPLATES + IQC_TEMPLATE_ITEMS 테이블 생성,
 *              품목별/템플릿 항목에 판정형 기준(JUDGE_CRITERIA) 컬럼 추가.
 *
 * 초보자 가이드:
 * 1. IQC_TEMPLATES: 템플릿 헤더 (시료단위·파괴검사 옵션 포함)
 * 2. IQC_TEMPLATE_ITEMS: 템플릿 검사항목 (측정형 LSL/USL 또는 판정형 JUDGE_CRITERIA)
 * 3. IQC_PART_SPEC_ITEMS.JUDGE_CRITERIA: 품목별 항목에도 판정형 기준 저장
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIqcTemplateAndJudgeCriteria1771886000000
  implements MigrationInterface
{
  name = 'AddIqcTemplateAndJudgeCriteria1771886000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "IQC_TEMPLATES" (
        "COMPANY" VARCHAR2(50) NOT NULL,
        "PLANT_CD" VARCHAR2(50) NOT NULL,
        "TEMPLATE_ID" VARCHAR2(50) NOT NULL,
        "TEMPLATE_NAME" VARCHAR2(200) NOT NULL,
        "SAMPLE_QTY" NUMBER DEFAULT 1 NOT NULL,
        "IS_DEST" CHAR(1) DEFAULT 'N' NOT NULL,
        "USE_YN" CHAR(1) DEFAULT 'Y' NOT NULL,
        "CREATED_BY" VARCHAR2(50),
        "UPDATED_BY" VARCHAR2(50),
        "CREATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        "UPDATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT "PK_IQC_TEMPLATES" PRIMARY KEY ("COMPANY", "PLANT_CD", "TEMPLATE_ID")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "IQC_TEMPLATE_ITEMS" (
        "COMPANY" VARCHAR2(50) NOT NULL,
        "PLANT_CD" VARCHAR2(50) NOT NULL,
        "TEMPLATE_ID" VARCHAR2(50) NOT NULL,
        "SEQ" NUMBER NOT NULL,
        "INSP_ITEM_CODE" VARCHAR2(20) NOT NULL,
        "LSL" NUMBER(12,4),
        "USL" NUMBER(12,4),
        "JUDGE_CRITERIA" VARCHAR2(500),
        "USE_YN" CHAR(1) DEFAULT 'Y' NOT NULL,
        "CREATED_BY" VARCHAR2(50),
        "UPDATED_BY" VARCHAR2(50),
        "CREATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        "UPDATED_AT" TIMESTAMP DEFAULT SYSTIMESTAMP,
        CONSTRAINT "PK_IQC_TEMPLATE_ITEMS" PRIMARY KEY ("COMPANY", "PLANT_CD", "TEMPLATE_ID", "SEQ"),
        CONSTRAINT "FK_IQC_TPL_ITEMS_TPL" FOREIGN KEY ("COMPANY", "PLANT_CD", "TEMPLATE_ID")
          REFERENCES "IQC_TEMPLATES" ("COMPANY", "PLANT_CD", "TEMPLATE_ID") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "IQC_PART_SPEC_ITEMS" ADD ("JUDGE_CRITERIA" VARCHAR2(500))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "IQC_PART_SPEC_ITEMS" DROP COLUMN "JUDGE_CRITERIA"`);
    await queryRunner.query(`DROP TABLE "IQC_TEMPLATE_ITEMS"`);
    await queryRunner.query(`DROP TABLE "IQC_TEMPLATES"`);
  }
}
