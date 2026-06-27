/**
 * @file 1771890000000-AddProcessCodeToMatIssueRequest.ts
 * @description MAT_ISSUE_REQUESTS에 PROCESS_CODE 컬럼 추가 — 출고 대상 공정 지정(ADR 0002).
 *
 * 출고 요청 시 공정을 지정하면, 출고가 원자재창고 → 공정재고(PROC_MAT_STOCKS=장착 대기)로 적재된다.
 * nullable: 공정 미지정 출고요청은 기존 단순 출고(MAT_OUT)로 처리.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessCodeToMatIssueRequest1771890000000 implements MigrationInterface {
  name = 'AddProcessCodeToMatIssueRequest1771890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "MAT_ISSUE_REQUESTS" ADD ("PROCESS_CODE" VARCHAR2(50))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "MAT_ISSUE_REQUESTS" DROP COLUMN "PROCESS_CODE"`,
    );
  }
}
