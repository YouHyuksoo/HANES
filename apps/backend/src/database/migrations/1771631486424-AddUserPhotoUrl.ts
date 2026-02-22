import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPhotoUrl1771631486424 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // USERS 테이블에 PHOTO_URL 컬럼 추가
        await queryRunner.query(`
            ALTER TABLE "USERS" ADD ("PHOTO_URL" VARCHAR2(500))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PHOTO_URL 컬럼 삭제
        await queryRunner.query(`
            ALTER TABLE "USERS" DROP COLUMN "PHOTO_URL"
        `);
    }

}
