import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMatIssueProdResultId1771882748530 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // MAT_ISSUES에 PROD_RESULT_ID 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE MAT_ISSUES 
            ADD PROD_RESULT_ID VARCHAR2(36)
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN MAT_ISSUES.PROD_RESULT_ID IS '생산실적 ID (자재 투입 이력 연결)'
        `);

        // 인덱스 생성
        await queryRunner.query(`
            CREATE INDEX IDX_MAT_ISSUES_PROD_RESULT_ID ON MAT_ISSUES(PROD_RESULT_ID)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IDX_MAT_ISSUES_PROD_RESULT_ID
        `);
        await queryRunner.query(`
            ALTER TABLE MAT_ISSUES 
            DROP COLUMN PROD_RESULT_ID
        `);
    }

}
