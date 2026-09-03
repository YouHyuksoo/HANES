/**
 * @file src/modules/master/validation/rules/warehouse.rules.ts
 * @description 창고/벤더바코드 도메인 기준정보 검증 규칙
 */
import type { ValidationRule } from './validation-rule.types';

export const WAREHOUSE_RULES: ValidationRule[] = [
  {
    id: 'REF-VBC-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '벤더 바코드 매핑 품목 미존재',
    description: '벤더 바코드 매핑의 품목이 품목마스터에 없습니다. 매핑을 정리하세요.',
    targetPath: '/master/vendor-barcode',
    sql: `SELECT v.VENDOR_BARCODE AS REF_KEY, v.ITEM_CODE AS ITEM_CODE
            FROM VENDOR_BARCODE_MAPPINGS v
           WHERE v.COMPANY = :company AND v.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = v.COMPANY AND p.PLANT_CD = v.PLANT_CD
                      AND p.ITEM_CODE = v.ITEM_CODE)`,
  },
  {
    id: 'REF-VBC-002',
    category: 'REF_INTEGRITY',
    severity: 'WARN',
    title: '벤더 바코드 매핑 벤더 미존재',
    description: '벤더 바코드 매핑의 벤더가 벤더마스터에 없습니다. 매핑을 정리하세요.',
    targetPath: '/master/vendor-barcode',
    sql: `SELECT v.VENDOR_BARCODE AS REF_KEY, v.VENDOR_CODE AS VENDOR_CODE
            FROM VENDOR_BARCODE_MAPPINGS v
           WHERE v.COMPANY = :company AND v.PLANT_CD = :plantCd
             AND v.VENDOR_CODE IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM VENDOR_MASTERS m
                    WHERE m.COMPANY = v.COMPANY AND m.PLANT_CD = v.PLANT_CD
                      AND m.VENDOR_CODE = v.VENDOR_CODE)`,
  },
  {
    id: 'INA-VBC-001',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: '벤더 바코드 매핑이 비활성 벤더 참조',
    description: '벤더 바코드 매핑이 사용중지(USE_YN=N)된 벤더를 참조합니다. 매핑을 정리하세요.',
    targetPath: '/master/vendor-barcode',
    sql: `SELECT v.VENDOR_BARCODE AS REF_KEY, v.VENDOR_CODE AS VENDOR_CODE, m.VENDOR_NAME AS VENDOR_NAME
            FROM VENDOR_BARCODE_MAPPINGS v
            JOIN VENDOR_MASTERS m
              ON m.COMPANY = v.COMPANY AND m.PLANT_CD = v.PLANT_CD
             AND m.VENDOR_CODE = v.VENDOR_CODE AND m.USE_YN = 'N'
           WHERE v.COMPANY = :company AND v.PLANT_CD = :plantCd`,
  },
  {
    id: 'REF-WH-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '창고 로케이션의 창고 미존재',
    description: '로케이션이 참조하는 창고가 창고마스터에 없습니다. 로케이션을 정리하세요.',
    targetPath: '/master/warehouse',
    sql: `SELECT l.WAREHOUSE_CODE || ' / ' || l.LOCATION_CODE AS REF_KEY, l.LOCATION_NAME AS LOCATION_NAME
            FROM WAREHOUSE_LOCATIONS l
           WHERE l.COMPANY = :company AND l.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM WAREHOUSES w
                    WHERE w.COMPANY = l.COMPANY AND w.PLANT_CD = l.PLANT_CD
                      AND w.WAREHOUSE_CODE = l.WAREHOUSE_CODE)`,
  },
  {
    id: 'REF-WH-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '창고 이동규칙 창고 미존재',
    description: '창고 이동규칙의 출발/도착 창고가 창고마스터에 없습니다. 규칙을 정리하세요.',
    targetPath: '/master/warehouse',
    sql: `SELECT r.FROM_WAREHOUSE_ID || ' → ' || r.TO_WAREHOUSE_ID AS REF_KEY
            FROM WAREHOUSE_TRANSFER_RULES r
           WHERE r.COMPANY = :company AND r.PLANT_CD = :plantCd
             AND (NOT EXISTS (
                    SELECT 1 FROM WAREHOUSES w
                     WHERE w.COMPANY = r.COMPANY AND w.PLANT_CD = r.PLANT_CD
                       AND w.WAREHOUSE_CODE = r.FROM_WAREHOUSE_ID)
               OR NOT EXISTS (
                    SELECT 1 FROM WAREHOUSES w
                     WHERE w.COMPANY = r.COMPANY AND w.PLANT_CD = r.PLANT_CD
                       AND w.WAREHOUSE_CODE = r.TO_WAREHOUSE_ID))`,
  },
];
