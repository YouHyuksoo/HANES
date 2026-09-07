import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpcDataEquipCode1771887000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // SPC_DATA 테이블에 EQUIP_CODE 컬럼 추가 (측정 설비 — DB 소스에서 헤드라인 "설비" 표시에 사용)
        await queryRunner.query(`
            ALTER TABLE "SPC_DATA" ADD ("EQUIP_CODE" VARCHAR2(50))
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_SPC_DATA_EQUIP_CODE" ON "SPC_DATA" ("EQUIP_CODE")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "IDX_SPC_DATA_EQUIP_CODE"
        `);

        await queryRunner.query(`
            ALTER TABLE "SPC_DATA" DROP COLUMN "EQUIP_CODE"
        `);
    }

}
