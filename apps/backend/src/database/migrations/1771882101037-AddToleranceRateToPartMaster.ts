import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToleranceRateToPartMaster1771882101037 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // TOLERANCE_RATE 컬럼 추가 (PO 수량 오차 허용률)
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            ADD TOLERANCE_RATE NUMBER(5,2) DEFAULT 5.0
        `);
        
        // 컬럼 코멘트 추가
        await queryRunner.query(`
            COMMENT ON COLUMN PART_MASTERS.TOLERANCE_RATE IS 'PO 수량 오차 허용률 (%)'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: 컬럼 삭제
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            DROP COLUMN TOLERANCE_RATE
        `);
    }

}
