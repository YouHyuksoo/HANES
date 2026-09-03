/**
 * @file src/modules/master/validation/rules/biz-reverse.rules.ts
 * @description 운영 데이터 역참조 검증 규칙 (DISTINCT 코드 집계 방식)
 */
import type { ValidationRule } from './validation-rule.types';

export const BIZ_REVERSE_RULES: ValidationRule[] = [
  {
    id: 'REV-STK-001',
    category: 'BIZ_REVERSE_REF',
    severity: 'ERROR',
    title: '입하재고가 미등록 품목 참조',
    description: '입하재고가 품목마스터에 없는 품목을 참조합니다. 품목을 등록하세요.',
    targetPath: '/master/part',
    sql: `SELECT s.ITEM_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM MAT_ARRIVAL_STOCKS s
           WHERE s.COMPANY = :company AND s.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = s.COMPANY AND p.PLANT_CD = s.PLANT_CD
                      AND p.ITEM_CODE = s.ITEM_CODE)
           GROUP BY s.ITEM_CODE`,
  },
  {
    id: 'REV-STK-002',
    category: 'BIZ_REVERSE_REF',
    severity: 'ERROR',
    title: '자재 LOT가 미등록 품목 참조',
    description: '자재 LOT가 품목마스터에 없는 품목을 참조합니다. 품목을 등록하세요.',
    targetPath: '/master/part',
    sql: `SELECT l.ITEM_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM MAT_LOTS l
           WHERE l.COMPANY = :company AND l.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = l.COMPANY AND p.PLANT_CD = l.PLANT_CD
                      AND p.ITEM_CODE = l.ITEM_CODE)
           GROUP BY l.ITEM_CODE`,
  },
  {
    id: 'REV-STK-003',
    category: 'BIZ_REVERSE_REF',
    severity: 'ERROR',
    title: '자재재고가 미등록 창고 참조',
    description: '자재재고가 창고마스터에 없는 창고를 참조합니다. 창고를 등록하세요.',
    targetPath: '/master/warehouse',
    sql: `SELECT s.WAREHOUSE_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM MAT_STOCKS s
           WHERE s.COMPANY = :company AND s.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM WAREHOUSES w
                    WHERE w.COMPANY = s.COMPANY AND w.PLANT_CD = s.PLANT_CD
                      AND w.WAREHOUSE_CODE = s.WAREHOUSE_CODE)
           GROUP BY s.WAREHOUSE_CODE`,
  },
  {
    id: 'REV-JOB-001',
    category: 'BIZ_REVERSE_REF',
    severity: 'ERROR',
    title: '작업지시가 미등록 품목 참조',
    description: '작업지시가 품목마스터에 없는 품목을 참조합니다. 품목을 등록하세요.',
    targetPath: '/master/part',
    sql: `SELECT j.ITEM_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM JOB_ORDERS j
           WHERE j.COMPANY = :company AND j.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = j.COMPANY AND p.PLANT_CD = j.PLANT_CD
                      AND p.ITEM_CODE = j.ITEM_CODE)
           GROUP BY j.ITEM_CODE`,
  },
  {
    id: 'REV-JOB-002',
    category: 'BIZ_REVERSE_REF',
    severity: 'WARN',
    title: '작업지시가 미등록 라인 참조',
    description: '작업지시가 라인마스터에 없는 라인을 참조합니다. 라인을 등록하거나 지시를 수정하세요.',
    targetPath: '/master/prod-line',
    sql: `SELECT j.LINE_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM JOB_ORDERS j
           WHERE j.COMPANY = :company AND j.PLANT_CD = :plantCd
             AND j.LINE_CODE IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM PROD_LINE_MASTERS l
                    WHERE l.COMPANY = j.COMPANY AND l.PLANT_CD = j.PLANT_CD
                      AND l.LINE_CODE = j.LINE_CODE)
           GROUP BY j.LINE_CODE`,
  },
  {
    id: 'REV-JOB-003',
    category: 'BIZ_REVERSE_REF',
    severity: 'ERROR',
    title: '작업지시가 미등록 라우팅 참조',
    description: '작업지시가 라우팅 그룹에 없는 라우팅을 참조합니다. 라우팅을 등록하거나 지시를 수정하세요.',
    targetPath: '/master/routing',
    sql: `SELECT j.ROUTING_CODE AS REF_KEY, COUNT(*) AS CNT
            FROM JOB_ORDERS j
           WHERE j.COMPANY = :company AND j.PLANT_CD = :plantCd
             AND j.ROUTING_CODE IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM ROUTING_GROUPS g
                    WHERE g.COMPANY = j.COMPANY AND g.PLANT_CD = j.PLANT_CD
                      AND g.ROUTING_CODE = j.ROUTING_CODE)
           GROUP BY j.ROUTING_CODE`,
  },
];
