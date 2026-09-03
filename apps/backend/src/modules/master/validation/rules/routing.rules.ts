/**
 * @file src/modules/master/validation/rules/routing.rules.ts
 * @description 라우팅 도메인 기준정보 검증 규칙
 */
import type { ValidationRule } from './validation-rule.types';

export const ROUTING_RULES: ValidationRule[] = [
  {
    id: 'REF-RTG-001',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '라우팅 그룹 품목 미존재',
    description: '라우팅 그룹의 품목이 품목마스터에 없습니다. 품목을 등록하거나 라우팅을 정리하세요.',
    targetPath: '/master/routing',
    sql: `SELECT g.ROUTING_CODE AS REF_KEY, g.ITEM_CODE AS ITEM_CODE, g.ROUTING_NAME AS ROUTING_NAME
            FROM ROUTING_GROUPS g
           WHERE g.COMPANY = :company AND g.PLANT_CD = :plantCd
             AND g.ITEM_CODE IS NOT NULL
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS p
                    WHERE p.COMPANY = g.COMPANY AND p.PLANT_CD = g.PLANT_CD
                      AND p.ITEM_CODE = g.ITEM_CODE)`,
  },
  {
    id: 'REF-RTG-002',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '라우팅 공정 미존재',
    description: '라우팅 공정 순서의 공정코드가 공정마스터에 없습니다. 공정을 등록하거나 순서를 수정하세요.',
    targetPath: '/master/routing',
    sql: `SELECT r.ROUTING_CODE || ' #' || r.SEQ AS REF_KEY, r.PROCESS_CODE AS PROCESS_CODE
            FROM ROUTING_PROCESSES r
           WHERE r.COMPANY = :company AND r.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM PROCESS_MASTERS m
                    WHERE m.COMPANY = r.COMPANY AND m.PLANT_CD = r.PLANT_CD
                      AND m.PROCESS_CODE = r.PROCESS_CODE)`,
  },
  {
    id: 'REF-RTG-003',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '라우팅 고아 공정순서',
    description: '공정 순서가 참조하는 라우팅 그룹이 없습니다. 고아 상세를 정리하세요.',
    targetPath: '/master/routing',
    sql: `SELECT r.ROUTING_CODE || ' #' || r.SEQ AS REF_KEY, r.PROCESS_CODE AS PROCESS_CODE
            FROM ROUTING_PROCESSES r
           WHERE r.COMPANY = :company AND r.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ROUTING_GROUPS g
                    WHERE g.COMPANY = r.COMPANY AND g.PLANT_CD = r.PLANT_CD
                      AND g.ROUTING_CODE = r.ROUTING_CODE)`,
  },
  {
    id: 'REF-RTG-004',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '라우팅 투입자재 미존재',
    description: '라우팅 투입 자재가 품목마스터에 없습니다. 품목을 등록하거나 투입 자재를 정리하세요.',
    targetPath: '/master/routing',
    sql: `SELECT m.ROUTING_CODE || ' #' || m.SEQ AS REF_KEY, m.CHILD_ITEM_CODE AS CHILD_ITEM_CODE
            FROM ROUTING_MATERIALS m
           WHERE m.COMPANY = :company AND m.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ITEM_MASTERS c
                    WHERE c.COMPANY = m.COMPANY AND c.PLANT_CD = m.PLANT_CD
                      AND c.ITEM_CODE = m.CHILD_ITEM_CODE)`,
  },
  {
    id: 'REF-RTG-005',
    category: 'REF_INTEGRITY',
    severity: 'ERROR',
    title: '라우팅 고아 투입자재',
    description: '투입 자재가 참조하는 라우팅 그룹이 없습니다. 고아 상세를 정리하세요.',
    targetPath: '/master/routing',
    sql: `SELECT m.ROUTING_CODE || ' #' || m.SEQ AS REF_KEY, m.CHILD_ITEM_CODE AS CHILD_ITEM_CODE
            FROM ROUTING_MATERIALS m
           WHERE m.COMPANY = :company AND m.PLANT_CD = :plantCd
             AND NOT EXISTS (
                   SELECT 1 FROM ROUTING_GROUPS g
                    WHERE g.COMPANY = m.COMPANY AND g.PLANT_CD = m.PLANT_CD
                      AND g.ROUTING_CODE = m.ROUTING_CODE)`,
  },
  {
    id: 'INA-RTG-001',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: '라우팅이 비활성 공정 참조',
    description: '라우팅이 사용중지(USE_YN=N)된 공정을 참조합니다. 공정을 교체하세요.',
    targetPath: '/master/routing',
    sql: `SELECT r.ROUTING_CODE || ' #' || r.SEQ AS REF_KEY, r.PROCESS_CODE AS PROCESS_CODE, p.PROCESS_NAME AS PROCESS_NAME
            FROM ROUTING_PROCESSES r
            JOIN PROCESS_MASTERS p
              ON p.COMPANY = r.COMPANY AND p.PLANT_CD = r.PLANT_CD
             AND p.PROCESS_CODE = r.PROCESS_CODE AND p.USE_YN = 'N'
           WHERE r.COMPANY = :company AND r.PLANT_CD = :plantCd`,
  },
  {
    id: 'INA-RTG-002',
    category: 'INACTIVE_REF',
    severity: 'WARN',
    title: '라우팅이 비활성 품목 참조',
    description: '라우팅 투입 자재가 사용중지(USE_YN=N)된 품목을 참조합니다. 자재를 교체하세요.',
    targetPath: '/master/routing',
    sql: `SELECT m.ROUTING_CODE || ' #' || m.SEQ AS REF_KEY, m.CHILD_ITEM_CODE AS CHILD_ITEM_CODE, c.ITEM_NAME AS ITEM_NAME
            FROM ROUTING_MATERIALS m
            JOIN ITEM_MASTERS c
              ON c.COMPANY = m.COMPANY AND c.PLANT_CD = m.PLANT_CD
             AND c.ITEM_CODE = m.CHILD_ITEM_CODE AND c.USE_YN = 'N'
           WHERE m.COMPANY = :company AND m.PLANT_CD = :plantCd`,
  },
  {
    id: 'DQ-RTG-001',
    category: 'DATA_QUALITY',
    severity: 'WARN',
    title: '활성 라우팅에 공정순서 없음',
    description: '사용 중(USE_YN=Y)인 라우팅 그룹에 활성 공정 순서가 0건입니다. 공정 순서를 등록하거나 라우팅을 비활성하세요.',
    targetPath: '/master/routing',
    sql: `SELECT g.ROUTING_CODE AS REF_KEY, g.ROUTING_NAME AS ROUTING_NAME
            FROM ROUTING_GROUPS g
           WHERE g.COMPANY = :company AND g.PLANT_CD = :plantCd
             AND g.USE_YN = 'Y'
             AND NOT EXISTS (
                   SELECT 1 FROM ROUTING_PROCESSES r
                    WHERE r.COMPANY = g.COMPANY AND r.PLANT_CD = g.PLANT_CD
                      AND r.ROUTING_CODE = g.ROUTING_CODE AND r.USE_YN = 'Y')`,
  },
];
