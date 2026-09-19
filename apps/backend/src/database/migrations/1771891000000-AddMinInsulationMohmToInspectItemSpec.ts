/**
 * @file 1771891000000-AddMinInsulationMohmToInspectItemSpec.ts
 * @description INSPECT_ITEM_SPECS에 MIN_INSULATION_MOHM(절연저항 하한, MΩ) 추가.
 *
 * 절연저항은 별도 검사기가 아니라 내전압(HIPOT) 검사기에서 같이 측정하므로 HIPOT 스펙 행에 하한만 둔다.
 * nullable: 하한이 없으면 절연저항을 판정하지 않는다(judgeInspectMeasurement).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMinInsulationMohmToInspectItemSpec1771891000000 implements MigrationInterface {
  name = 'AddMinInsulationMohmToInspectItemSpec1771891000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "INSPECT_ITEM_SPECS" ADD ("MIN_INSULATION_MOHM" NUMBER(10,3))`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "INSPECT_ITEM_SPECS"."MIN_INSULATION_MOHM" IS '절연저항 하한 (MΩ) - HIPOT 스펙에서 같이 판정'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "INSPECT_ITEM_SPECS" DROP COLUMN "MIN_INSULATION_MOHM"`,
    );
  }
}
