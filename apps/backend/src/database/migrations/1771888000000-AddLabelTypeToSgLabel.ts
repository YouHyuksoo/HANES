/**
 * @file 1771888000000-AddLabelTypeToSgLabel.ts
 * @description SG_LABELS에 LABEL_TYPE 컬럼 추가 — 묶음(BUNDLE)과 회로(SG)를 한 테이블에서 구분(ADR 0001).
 *
 * 값 도메인: BUNDLE(묶음 추적 라벨, 가닥 묶음) / SG(반제품 회로).
 * 운영 데이터가 없어 기본값 'SG'로 둔다. 발행 시 공정 ISSUE_LABEL_TYPE에 따라 BUNDLE/SG가 기록된다.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLabelTypeToSgLabel1771888000000 implements MigrationInterface {
  name = 'AddLabelTypeToSgLabel1771888000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "SG_LABELS" ADD ("LABEL_TYPE" VARCHAR2(20) DEFAULT 'SG')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "SG_LABELS" DROP COLUMN "LABEL_TYPE"`,
    );
  }
}
