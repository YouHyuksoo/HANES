/**
 * @file 1771885000000-AlignRemainingTenantPrimaryKeys.ts
 * @description 멀티테넌시 PK 정합화 — 컬럼은 있으나 PK에 COMPANY/PLANT_CD가
 *              빠진 18개 테이블의 PK를 (COMPANY, PLANT_CD, ...자연키)로 재구성한다.
 *              부모 PK를 참조하는 3개 FK는 drop → PK 재구성 → 테넌트 포함 FK 재생성.
 *
 * 초보자 가이드:
 * 1. 멱등(idempotent): dropPrimaryKey/dropConstraintIfExists로 반복 실행 안전
 * 2. 기존 Align* 마이그레이션이 FK 처리를 누락한 버그를 본 파일이 통합 보정
 * 3. 적용 전 NULL/FK 정합성 precheck 완료 (pk_fk_precheck.py)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignRemainingTenantPrimaryKeys1771885000000
  implements MigrationInterface
{
  name = 'AlignRemainingTenantPrimaryKeys1771885000000';

  // [table, pkName, columns]
  private readonly PK_DEFS: [string, string, string][] = [
    ['IQC_GROUPS', 'PK_IQC_GROUPS', '"COMPANY", "PLANT_CD", "GROUP_CODE"'],
    ['IQC_GROUP_ITEMS', 'PK_IQC_GROUP_ITEMS', '"COMPANY", "PLANT_CD", "GROUP_ID", "INSP_ITEM_ID"'],
    ['IQC_ITEM_MASTERS', 'PK_IQC_ITEM_MASTERS', '"COMPANY", "PLANT_CD", "ITEM_CODE", "SEQ"'],
    ['IQC_ITEM_POOL', 'PK_IQC_ITEM_POOL', '"COMPANY", "PLANT_CD", "INSP_ITEM_CODE"'],
    ['IQC_PART_LINKS', 'PK_IQC_PART_LINKS', '"COMPANY", "PLANT_CD", "ITEM_CODE", "PARTNER_CODE"'],
    ['MAT_STOCKS', 'PK_MAT_STOCKS', '"COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "ITEM_CODE", "MAT_UID"'],
    ['PRODUCT_STOCKS', 'PK_PRODUCT_STOCKS', '"COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "ITEM_CODE", "PRD_UID"'],
    ['MENU_CATEGORIES', 'PK_MENU_CATEGORIES', '"COMPANY", "PLANT_CD", "CATEGORY_CODE"'],
    ['MENU_CATEGORY_ITEMS', 'PK_MENU_CATEGORY_ITEMS', '"COMPANY", "PLANT_CD", "MENU_CODE"'],
    ['PDA_ROLE', 'PK_PDA_ROLE', '"COMPANY", "PLANT_CD", "CODE"'],
    ['PROCESS_QUALITY_CONDITIONS', 'PK_PROCESS_QUALITY_COND', '"COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ", "CONDITION_SEQ"'],
    ['ROLES', 'PK_ROLES', '"COMPANY", "PLANT_CD", "CODE"'],
    ['ROUTING_GROUPS', 'PK_ROUTING_GROUPS', '"COMPANY", "PLANT_CD", "ROUTING_CODE"'],
    ['ROUTING_MATERIALS', 'PK_ROUTING_MATERIALS', '"COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ", "CHILD_ITEM_CODE"'],
    ['ROUTING_PROCESSES', 'PK_ROUTING_PROCESSES', '"COMPANY", "PLANT_CD", "ROUTING_CODE", "SEQ"'],
    ['WAREHOUSES', 'PK_WAREHOUSES', '"COMPANY", "PLANT_CD", "WAREHOUSE_CODE"'],
    ['WAREHOUSE_LOCATIONS', 'PK_WAREHOUSE_LOCATIONS', '"COMPANY", "PLANT_CD", "WAREHOUSE_CODE", "LOCATION_CODE"'],
    ['WAREHOUSE_TRANSFER_RULES', 'PK_WAREHOUSE_TRANSFER_RULES', '"COMPANY", "PLANT_CD", "FROM_WAREHOUSE_ID", "TO_WAREHOUSE_ID"'],
  ];

  // [child, fkName, childCols, parent, parentCols]
  private readonly FK_DEFS: [string, string, string, string, string][] = [
    ['ROLE_MENU_PERMISSIONS', 'FK_ROLE_MENU_ROLE', '"COMPANY", "PLANT_CD", "ROLE_CODE"', 'ROLES', '"COMPANY", "PLANT_CD", "CODE"'],
    ['MENU_CATEGORY_ITEMS', 'FK_MCI_CATEGORY', '"COMPANY", "PLANT_CD", "CATEGORY_CODE"', 'MENU_CATEGORIES', '"COMPANY", "PLANT_CD", "CATEGORY_CODE"'],
    ['IQC_PART_SPEC_ITEMS', 'FK_SPEC_ITEMS_INSP', '"COMPANY", "PLANT_CD", "INSP_ITEM_CODE"', 'IQC_ITEM_POOL', '"COMPANY", "PLANT_CD", "INSP_ITEM_CODE"'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 부모 PK를 참조하는 FK 먼저 제거
    for (const [child, fk] of this.FK_DEFS) {
      await this.dropConstraintIfExists(queryRunner, child, fk);
    }
    // 2. 18개 테이블 PK 재구성 (테넌트 포함)
    for (const [table, pkName, cols] of this.PK_DEFS) {
      await this.dropPrimaryKey(queryRunner, table);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${pkName}" PRIMARY KEY (${cols})`,
      );
    }
    // 3. FK를 테넌트 포함 복합키로 재생성
    for (const [child, fk, childCols, parent, parentCols] of this.FK_DEFS) {
      await queryRunner.query(
        `ALTER TABLE "${child}" ADD CONSTRAINT "${fk}" FOREIGN KEY (${childCols}) REFERENCES "${parent}" (${parentCols})`,
      );
    }
  }

  public async down(): Promise<void> {
    // 비테넌트 PK로의 역마이그레이션은 데이터 충돌 위험으로 미지원
    throw new Error('AlignRemainingTenantPrimaryKeys: down 미지원');
  }

  private async dropPrimaryKey(qr: QueryRunner, table: string): Promise<void> {
    await qr.query(`
      DECLARE v_name USER_CONSTRAINTS.CONSTRAINT_NAME%TYPE;
      BEGIN
        SELECT CONSTRAINT_NAME INTO v_name FROM USER_CONSTRAINTS
        WHERE TABLE_NAME = '${table}' AND CONSTRAINT_TYPE = 'P';
        EXECUTE IMMEDIATE 'ALTER TABLE "${table}" DROP CONSTRAINT "' || v_name || '"';
      EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
      END;`);
  }

  private async dropConstraintIfExists(
    qr: QueryRunner,
    table: string,
    name: string,
  ): Promise<void> {
    await qr.query(`
      DECLARE v_cnt NUMBER;
      BEGIN
        SELECT COUNT(*) INTO v_cnt FROM USER_CONSTRAINTS
        WHERE TABLE_NAME = '${table}' AND CONSTRAINT_NAME = '${name}';
        IF v_cnt > 0 THEN
          EXECUTE IMMEDIATE 'ALTER TABLE "${table}" DROP CONSTRAINT "${name}"';
        END IF;
      END;`);
  }
}
