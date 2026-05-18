import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartImageUrl1771882900000 implements MigrationInterface {
  name = 'AddPartImageUrl1771882900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ITEM_MASTERS" ADD ("IMAGE_URL" VARCHAR2(500))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ITEM_MASTERS" DROP COLUMN "IMAGE_URL"
    `);
  }
}
