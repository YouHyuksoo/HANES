import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTraceLogParentId1771882596757 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // PARENT_ID 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE TRACE_LOGS 
            ADD PARENT_ID VARCHAR2(36)
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN TRACE_LOGS.PARENT_ID IS '부모 시리얼 ID (반제품→완제품 연결)'
        `);

        // 인덱스 생성
        await queryRunner.query(`
            CREATE INDEX IDX_TRACE_LOGS_PARENT_ID ON TRACE_LOGS(PARENT_ID)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IDX_TRACE_LOGS_PARENT_ID
        `);
        await queryRunner.query(`
            ALTER TABLE TRACE_LOGS 
            DROP COLUMN PARENT_ID
        `);
    }

}
