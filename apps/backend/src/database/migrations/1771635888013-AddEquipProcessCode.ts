import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEquipProcessCode1771635888013 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // EQUIP_MASTERS 테이블에 PROCESS_CODE 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "EQUIP_MASTERS" ADD ("PROCESS_CODE" VARCHAR2(50))
        `);
        
        // INDEX 추가 (성능 향상)
        await queryRunner.query(`
            CREATE INDEX "IDX_EQUIP_PROCESS_CODE" ON "EQUIP_MASTERS" ("PROCESS_CODE")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // INDEX 삭제
        await queryRunner.query(`
            DROP INDEX "IDX_EQUIP_PROCESS_CODE"
        `);
        
        // PROCESS_CODE 컬럼 삭제
        await queryRunner.query(`
            ALTER TABLE "EQUIP_MASTERS" DROP COLUMN "PROCESS_CODE"
        `);
    }

}
