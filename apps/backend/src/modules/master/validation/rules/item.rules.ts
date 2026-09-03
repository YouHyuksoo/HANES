/**
 * @file src/modules/master/validation/rules/item.rules.ts
 * @description 품목/공정/설비/CAPA/소모품 도메인 기준정보 검증 규칙
 */
import type { ValidationRule } from './validation-rule.types';

export const ITEM_RULES: ValidationRule[] = [
  {
    id: 'REF-PRC-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '공정-설비 매핑 공정 미존재',
    description: '공정-설비 매핑의 공정코드가 공정마스터에 없습니다. 매핑을 정리하세요.',
    targetPath: '/master/process',
    sql: `SELECT e.PROCESS_CODE || ' / ' || e.EQUIP_CODE AS REF_KEY, e.EQUIP_CODE AS EQUIP_CODE
            FROM PROCESS_EQUIPMENTS e
           WHERE e.COMPANY = :company AND e.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM PROCESS_MASTERS m
                    WHERE m.COMPANY = e.COMPANY AND m.PLANT_CD = e.PLANT_CD
                      AND m.PROCESS_CODE = e.PROCESS_CODE)`,
  },
  {
    id: 'REF-PRC-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '공정-설비 매핑 설비 미존재',
    description: '공정-설비 매핑의 설비코드가 설비마스터에 없습니다. 매핑을 정리하세요.',
    targetPath: '/master/equip',
    sql: `SELECT e.PROCESS_CODE || ' / ' || e.EQUIP_CODE AS REF_KEY, e.PROCESS_CODE AS PROCESS_CODE
            FROM PROCESS_EQUIPMENTS e
           WHERE e.COMPANY = :company AND e.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM EQUIP_MASTERS q
                    WHERE q.COMPANY = e.COMPANY AND q.PLANT_CD = e.PLANT_CD
                      AND q.EQUIP_CODE = e.EQUIP_CODE)`,
  },
  {
    id: 'INA-PRC-001',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: '공정-설비 매핑이 비활성 설비 참조',
    description: '공정-설비 매핑이 사용중지(USE_YN=N)된 설비를 참조합니다. 매핑을 해제하세요.',
    targetPath: '/master/equip',
    sql: `SELECT e.PROCESS_CODE || ' / ' || e.EQUIP_CODE AS REF_KEY, q.EQUIP_NAME AS EQUIP_NAME
            FROM PROCESS_EQUIPMENTS e
            JOIN EQUIP_MASTERS q
              ON q.COMPANY = e.COMPANY AND q.PLANT_CD = e.PLANT_CD
             AND q.EQUIP_CODE = e.EQUIP_CODE AND q.USE_YN = 'N'
           WHERE e.COMPANY = :company AND e.PLANT_CD = :plantCd`,
  },
  {
    id: 'REF-CAPA-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '공정 CAPA 공정 미존재',
    description: '공정 CAPA의 공정코드가 공정마스터에 없습니다. CAPA 행을 정리하세요.',
    targetPath: '/master/process-capa',
    sql: `SELECT c.PROCESS_CODE || ' / ' || c.ITEM_CODE AS REF_KEY, c.ITEM_CODE AS ITEM_CODE
            FROM PROCESS_CAPAS c
           WHERE c.COMPANY = :company AND c.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM PROCESS_MASTERS m
                    WHERE m.COMPANY = c.COMPANY AND m.PLANT_CD = c.PLANT_CD
                      AND m.PROCESS_CODE = c.PROCESS_CODE)`,
  },
  {
    id: 'REF-CAPA-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '공정 CAPA 품목 미존재',
    description: '공정 CAPA의 품목코드가 품목마스터에 없습니다. CAPA 행을 정리하세요.',
    targetPath: '/master/process-capa',
    sql: `SELECT c.PROCESS_CODE || ' / ' || c.ITEM_CODE AS REF_KEY, c.PROCESS_CODE AS PROCESS_CODE
            FROM PROCESS_CAPAS c
           WHERE c.COMPANY = :company AND c.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = c.COMPANY AND p.PLANT_CD = c.PLANT_CD
                      AND p.ITEM_CODE = c.ITEM_CODE)`,
  },
  {
    id: 'DQ-CAPA-001',
    category: 'DATA_QUALITY',
    severity: 'WARN',
    title: '공정 CAPA 생산능력 0/누락',
    description: 'STD_UPH와 DAILY_CAPA가 모두 NULL 또는 0입니다. 생산능력을 입력하세요.',
    targetPath: '/master/process-capa',
    sql: `SELECT c.PROCESS_CODE || ' / ' || c.ITEM_CODE AS REF_KEY, c.STD_UPH AS STD_UPH, c.DAILY_CAPA AS DAILY_CAPA
            FROM PROCESS_CAPAS c
           WHERE c.COMPANY = :company AND c.PLANT_CD = :plantCd
             AND c.USE_YN = 'Y'
             AND (c.STD_UPH IS NULL OR c.STD_UPH <= 0)
             AND (c.DAILY_CAPA IS NULL OR c.DAILY_CAPA <= 0)`,
  },
  {
    id: 'DQ-ITEM-001',
    category: 'DATA_QUALITY',
    severity: 'ERROR',
    title: '품목명 누락',
    description: '품목마스터의 품목명(ITEM_NAME)이 비어 있습니다. 품목명을 입력하세요.',
    targetPath: '/master/part',
    sql: `SELECT p.ITEM_CODE AS REF_KEY, p.ITEM_TYPE AS ITEM_TYPE
            FROM ITEM_MASTERS p
           WHERE p.COMPANY = :company AND p.PLANT_CD = :plantCd
             AND (p.ITEM_NAME IS NULL OR TRIM(p.ITEM_NAME) = '')`,
  },
  {
    id: 'DQ-ITEM-002',
    category: 'DATA_QUALITY',
    severity: 'WARN',
    title: '품목유형이 공통코드 밖 값',
    description: '품목유형(ITEM_TYPE)이 공통코드 ITEM_TYPE 그룹의 활성 코드가 아닙니다. 공통코드를 확인하세요.',
    targetPath: '/master/part',
    sql: `SELECT p.ITEM_CODE AS REF_KEY, p.ITEM_TYPE AS ITEM_TYPE
            FROM ITEM_MASTERS p
           WHERE p.COMPANY = :company AND p.PLANT_CD = :plantCd
             AND p.ITEM_TYPE IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM COM_CODES cd
                    WHERE cd.COMPANY = p.COMPANY AND cd.PLANT_CD = p.PLANT_CD
                      AND cd.GROUP_CODE = 'ITEM_TYPE' AND cd.DETAIL_CODE = p.ITEM_TYPE
                      AND cd.USE_YN = 'Y')`,
  },
  {
    id: 'REF-CNS-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '소모품 사용 정의 품목 미존재',
    description: '소모품 사용 정의의 품목이 품목마스터에 없습니다. 사용 정의를 정리하세요.',
    targetPath: '/master/equip',
    sql: `SELECT u.PRODUCT_ITEM_CODE || ' / ' || u.EQUIP_CODE || ' / ' || u.CONSUMABLE_CODE AS REF_KEY
            FROM CONSUMABLE_USAGE_MAP u
           WHERE u.COMPANY = :company AND u.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = u.COMPANY AND p.PLANT_CD = u.PLANT_CD
                      AND p.ITEM_CODE = u.PRODUCT_ITEM_CODE)`,
  },
  {
    id: 'REF-CNS-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '소모품 사용 정의 설비 미존재',
    description: '소모품 사용 정의의 설비가 설비마스터에 없습니다. 사용 정의를 정리하세요.',
    targetPath: '/master/equip',
    sql: `SELECT u.PRODUCT_ITEM_CODE || ' / ' || u.EQUIP_CODE || ' / ' || u.CONSUMABLE_CODE AS REF_KEY
            FROM CONSUMABLE_USAGE_MAP u
           WHERE u.COMPANY = :company AND u.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM EQUIP_MASTERS q
                    WHERE q.COMPANY = u.COMPANY AND q.PLANT_CD = u.PLANT_CD
                      AND q.EQUIP_CODE = u.EQUIP_CODE)`,
  },
  {
    id: 'REF-CNS-003',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '소모품 사용 정의 소모품 미존재',
    description: '소모품 사용 정의의 소모품이 소모품마스터에 없습니다. 사용 정의를 정리하세요.',
    targetPath: '/master/equip',
    sql: `SELECT u.PRODUCT_ITEM_CODE || ' / ' || u.EQUIP_CODE || ' / ' || u.CONSUMABLE_CODE AS REF_KEY
            FROM CONSUMABLE_USAGE_MAP u
           WHERE u.COMPANY = :company AND u.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM CONSUMABLE_MASTERS m
                    WHERE m.COMPANY = u.COMPANY AND m.PLANT_CD = u.PLANT_CD
                      AND m.CONSUMABLE_CODE = u.CONSUMABLE_CODE)`,
  },
];
