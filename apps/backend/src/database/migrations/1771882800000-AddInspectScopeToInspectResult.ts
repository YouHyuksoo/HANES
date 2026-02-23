import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @file AddInspectScopeToInspectResult.ts
 * @description Q10-1: 검사 범위 구분 필드 추가
 * 
 * 기능:
 * - INSPECT_SCOPE 컬럼 추가 (검사 범위: FULL=전수검사, SAMPLE=샘플링검사)
 * - 인덱스 생성으로 검색 성능 향상
 */

export class AddInspectScopeToInspectResult1771882800000 implements MigrationInterface {
  name = 'AddInspectScopeToInspectResult1771882800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. INSPECT_SCOPE 컬럼 추가
    await queryRunner.query(`
      ALTER TABLE INSPECT_RESULTS 
      ADD (INSPECT_SCOPE VARCHAR2(20) NULL)
    `);

    // 2. 컬럼 코멘트 추가
    await queryRunner.query(`
      COMMENT ON COLUMN INSPECT_RESULTS.INSPECT_SCOPE IS '검사범위 (FULL: 전수검사, SAMPLE: 샘플링검사)'
    `);

    // 3. 인덱스 생성
    await queryRunner.query(`
      CREATE INDEX IDX_INSPECT_SCOPE ON INSPECT_RESULTS(INSPECT_SCOPE)
    `);

    console.log('✅ INSPECT_SCOPE 컬럼 추가 완료');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 인덱스 삭제
    await queryRunner.query(`DROP INDEX IDX_INSPECT_SCOPE`);

    // 2. 컬럼 삭제
    await queryRunner.query(`ALTER TABLE INSPECT_RESULTS DROP COLUMN INSPECT_SCOPE`);

    console.log('⏪ INSPECT_SCOPE 컬럼 제거 완료');
  }
}
