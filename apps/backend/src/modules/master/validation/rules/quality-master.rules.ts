/**
 * @file src/modules/master/validation/rules/quality-master.rules.ts
 * @description IQC/설비점검 기준정보 도메인 검증 규칙
 */
import type { ValidationRule } from './validation-rule.types';

export const QUALITY_MASTER_RULES: ValidationRule[] = [
  {
    id: 'REF-IQC-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: 'IQC 품목 기준 품목 미존재',
    description: '품목별 IQC 기준의 품목이 품목마스터에 없습니다. IQC 기준을 정리하세요.',
    targetPath: '/master/iqc-part-spec',
    sql: `SELECT s.ITEM_CODE AS REF_KEY
            FROM IQC_PART_SPECS s
           WHERE s.COMPANY = :company AND s.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = s.COMPANY AND p.PLANT_CD = s.PLANT_CD
                      AND p.ITEM_CODE = s.ITEM_CODE)`,
  },
  {
    id: 'REF-IQC-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: 'IQC 검사항목 미존재',
    description: '품목별 IQC 세부 항목의 검사항목이 검사항목 풀에 없습니다. 항목을 교체하세요.',
    targetPath: '/master/iqc-part-spec',
    sql: `SELECT i.ITEM_CODE || ' #' || i.SEQ AS REF_KEY, i.INSP_ITEM_CODE AS INSP_ITEM_CODE
            FROM IQC_PART_SPEC_ITEMS i
           WHERE i.COMPANY = :company AND i.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM IQC_ITEM_POOL pool
                    WHERE pool.COMPANY = i.COMPANY AND pool.PLANT_CD = i.PLANT_CD
                      AND pool.INSP_ITEM_CODE = i.INSP_ITEM_CODE)`,
  },
  {
    id: 'INA-IQC-001',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: 'IQC 기준이 비활성 검사항목 참조',
    description: 'IQC 세부 항목이 사용중지(USE_YN=N)된 검사항목을 참조합니다. 항목을 교체하세요.',
    targetPath: '/master/iqc-part-spec',
    sql: `SELECT i.ITEM_CODE || ' #' || i.SEQ AS REF_KEY, i.INSP_ITEM_CODE AS INSP_ITEM_CODE, pool.INSP_ITEM_NAME AS INSP_ITEM_NAME
            FROM IQC_PART_SPEC_ITEMS i
            JOIN IQC_ITEM_POOL pool
              ON pool.COMPANY = i.COMPANY AND pool.PLANT_CD = i.PLANT_CD
             AND pool.INSP_ITEM_CODE = i.INSP_ITEM_CODE AND pool.USE_YN = 'N'
           WHERE i.COMPANY = :company AND i.PLANT_CD = :plantCd`,
  },
  {
    id: 'INA-IQC-002',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: 'IQC 기준이 비활성 품목 참조',
    description: '품목별 IQC 기준이 사용중지(USE_YN=N)된 품목을 참조합니다. 기준을 정리하세요.',
    targetPath: '/master/iqc-part-spec',
    sql: `SELECT s.ITEM_CODE AS REF_KEY, p.ITEM_NAME AS ITEM_NAME
            FROM IQC_PART_SPECS s
            JOIN ITEM_MASTERS p
              ON p.COMPANY = s.COMPANY AND p.PLANT_CD = s.PLANT_CD
             AND p.ITEM_CODE = s.ITEM_CODE AND p.USE_YN = 'N'
           WHERE s.COMPANY = :company AND s.PLANT_CD = :plantCd`,
  },
  {
    id: 'REF-EQP-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '설비 점검항목 풀 설비 미존재',
    description: '설비 점검항목 풀의 설비가 설비마스터에 없습니다. 풀 항목을 정리하세요.',
    targetPath: '/master/equip-inspect-item',
    sql: `SELECT p.EQUIP_CODE || ' / ' || p.ITEM_CODE || ' / ' || p.INSPECT_TYPE AS REF_KEY
            FROM EQUIP_INSPECT_ITEM_POOL p
           WHERE p.COMPANY = :company AND p.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM EQUIP_MASTERS q
                    WHERE q.COMPANY = p.COMPANY AND q.PLANT_CD = p.PLANT_CD
                      AND q.EQUIP_CODE = p.EQUIP_CODE)`,
  },
  {
    id: 'REF-EQP-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '설비 점검항목 풀 항목 미존재',
    description: '설비 점검항목 풀의 항목코드가 설비점검항목 마스터에 없습니다. 풀 항목을 정리하세요.',
    targetPath: '/master/equip-inspect-item',
    sql: `SELECT p.EQUIP_CODE || ' / ' || p.ITEM_CODE || ' / ' || p.INSPECT_TYPE AS REF_KEY
            FROM EQUIP_INSPECT_ITEM_POOL p
           WHERE p.COMPANY = :company AND p.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM EQUIP_INSPECT_ITEM_MASTERS m
                    WHERE m.COMPANY = p.COMPANY AND m.PLANT_CD = p.PLANT_CD
                      AND m.ITEM_CODE = p.ITEM_CODE)`,
  },
];
