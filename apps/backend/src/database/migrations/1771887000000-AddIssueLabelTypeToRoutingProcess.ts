/**
 * @file 1771887000000-AddIssueLabelTypeToRoutingProcess.ts
 * @description 라우팅 공정 라벨 발행을 단일 종류 컬럼(ISSUE_LABEL_TYPE)으로 일원화.
 *
 * 단계 1 정책:
 * 1. ROUTING_PROCESSES.ISSUE_LABEL_TYPE 컬럼을 추가한다(DEFAULT 'NONE').
 *    값 도메인: NONE / BUNDLE(묶음 추적 라벨) / SG(반제품) / FG(완제품). 한 공정 한 종류.
 * 2. 기존 ISSUE_SG_LABEL_YN / ISSUE_FG_LABEL_YN 컬럼은 드롭하지 않는다.
 *    (자동 변환도 하지 않는다 — 운영자가 라우팅 화면에서 종류를 다시 지정한다.)
 *    이전 Y/N 플래그를 ISSUE_LABEL_TYPE 으로 추정 변환하면 묶음/SG 구분을 임의로 단정하게 되어
 *    프로젝트 원칙(추정 금지·fail loud)에 어긋난다. 기존 컬럼 정리는 후속 단계에서 별도 처리.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIssueLabelTypeToRoutingProcess1771887000000
  implements MigrationInterface
{
  name = 'AddIssueLabelTypeToRoutingProcess1771887000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ROUTING_PROCESSES" ADD ("ISSUE_LABEL_TYPE" VARCHAR2(20) DEFAULT 'NONE')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ROUTING_PROCESSES" DROP COLUMN "ISSUE_LABEL_TYPE"`,
    );
  }
}
