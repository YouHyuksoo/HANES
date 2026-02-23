import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartMasterFields1771882552632 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // IS_SPLITTABLE 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            ADD IS_SPLITTABLE VARCHAR2(1) DEFAULT 'Y'
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN PART_MASTERS.IS_SPLITTABLE IS '자재 분할 가능 여부 (Y/N)'
        `);

        // SAMPLE_QTY 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            ADD SAMPLE_QTY NUMBER(10)
        `);
        await queryRunner.query(`
            COMMENT ON COLUMN PART_MASTERS.SAMPLE_QTY IS '샘플검사 수량'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            DROP COLUMN IS_SPLITTABLE
        `);
        await queryRunner.query(`
            ALTER TABLE PART_MASTERS 
            DROP COLUMN SAMPLE_QTY
        `);
    }

}
