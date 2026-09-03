/**
 * @file src/modules/master/validation/rules/bom.rules.ts
 * @description BOM 도메인 기준정보 검증 규칙
 */
import type { ValidationRule } from './validation-rule.types';

export const BOM_RULES: ValidationRule[] = [
  {
    id: 'REF-BOM-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: 'BOM 모품목 미존재',
    description: 'BOM의 모품목이 품목마스터에 없습니다. 품목마스터에 등록하거나 BOM 행을 정리하세요.',
    targetPath: '/master/bom',
    sql: `SELECT DISTINCT b.PARENT_ITEM_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM BOM_MASTERS b
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = b.COMPANY AND p.PLANT_CD = b.PLANT_CD
                      AND p.ITEM_CODE = b.PARENT_ITEM_CODE)
           GROUP BY b.PARENT_ITEM_CODE`,
  },
  {
    id: 'REF-BOM-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: 'BOM 자품목 미존재',
    description: 'BOM의 자품목이 품목마스터에 없습니다. 품목마스터에 등록하거나 BOM 행을 정리하세요.',
    targetPath: '/master/bom',
    sql: `SELECT DISTINCT b.CHILD_ITEM_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM BOM_MASTERS b
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS c
                    WHERE c.COMPANY = b.COMPANY AND c.PLANT_CD = b.PLANT_CD
                      AND c.ITEM_CODE = b.CHILD_ITEM_CODE)
           GROUP BY b.CHILD_ITEM_CODE`,
  },
  {
    id: 'INA-BOM-001',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: 'BOM이 비활성 자품목 참조',
    description: 'BOM이 사용중지(USE_YN=N)된 자품목을 참조합니다. 대체 품목으로 변경하세요.',
    targetPath: '/master/bom',
    sql: `SELECT DISTINCT b.CHILD_ITEM_CODE AS REF_KEY, b.PARENT_ITEM_CODE AS PARENT_ITEM, c.ITEM_NAME AS ITEM_NAME
            FROM BOM_MASTERS b
            JOIN ITEM_MASTERS c
              ON c.COMPANY = b.COMPANY AND c.PLANT_CD = b.PLANT_CD
             AND c.ITEM_CODE = b.CHILD_ITEM_CODE AND c.USE_YN = 'N'
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd`,
  },
  {
    id: 'INA-BOM-002',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: 'BOM이 비활성 모품목 참조',
    description: 'BOM이 사용중지(USE_YN=N)된 모품목을 참조합니다. BOM을 정리하세요.',
    targetPath: '/master/bom',
    sql: `SELECT DISTINCT b.PARENT_ITEM_CODE AS REF_KEY, p.ITEM_NAME AS ITEM_NAME
            FROM BOM_MASTERS b
            JOIN ITEM_MASTERS p
              ON p.COMPANY = b.COMPANY AND p.PLANT_CD = b.PLANT_CD
             AND p.ITEM_CODE = b.PARENT_ITEM_CODE AND p.USE_YN = 'N'
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd`,
  },
  {
    id: 'DQ-BOM-001',
    category: 'DATA_QUALITY',
    severity: 'ERROR',
    title: 'BOM 소요량 누락/0 이하',
    description: 'BOM 소요량(QTY_PER)이 NULL이거나 0 이하입니다. 올바른 소요량을 입력하세요.',
    targetPath: '/master/bom',
    sql: `SELECT b.PARENT_ITEM_CODE || ' → ' || b.CHILD_ITEM_CODE AS REF_KEY, b.QTY_PER AS QTY_PER
            FROM BOM_MASTERS b
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd
             AND (b.QTY_PER IS NULL OR b.QTY_PER <= 0)`,
  },
  {
    id: 'DQ-BOM-002',
    category: 'DATA_QUALITY',
    severity: 'ERROR',
    title: 'BOM 유효기간 역전',
    description: '적용종료일(VALID_TO)이 적용시작일(VALID_FROM)보다 빠릅니다. 유효기간을 수정하세요.',
    targetPath: '/master/bom',
    sql: `SELECT b.PARENT_ITEM_CODE || ' → ' || b.CHILD_ITEM_CODE AS REF_KEY,
                 TO_CHAR(b.VALID_FROM, 'YYYY-MM-DD') AS VALID_FROM, TO_CHAR(b.VALID_TO, 'YYYY-MM-DD') AS VALID_TO
            FROM BOM_MASTERS b
           WHERE b.COMPANY = :company AND b.PLANT_CD = :plantCd
             AND b.VALID_TO IS NOT NULL AND b.VALID_TO < b.VALID_FROM`,
  },
];
