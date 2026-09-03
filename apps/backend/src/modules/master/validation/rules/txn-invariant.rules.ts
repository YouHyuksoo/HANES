/**
 * @file src/modules/master/validation/rules/txn-invariant.rules.ts
 * @description 트랜잭션 불변식 검증 규칙 — 서로 다른 테이블/소스에 중복 저장된 같은 사실이 일치하는지 검사한다.
 *
 * 배경(2026-09-03 현장 개선요청 2차분): 집계 컬럼(JOB_ORDERS.GOOD_QTY)과 원천(PROD_RESULTS), 출고 이력과 공정재고,
 * 출고요청 상태와 배분 수량, 메뉴코드 4소스처럼 "같은 사실을 두 곳에 쓰는" 구조는 한쪽만 갱신되는 결함이 잠복한다.
 * 이 규칙들은 그 등식을 SQL로 고정해 정기 실행(SCHEDULER_JOBS MST_VALIDATION_DAILY)과 온디맨드 화면에서 드러낸다.
 *
 * 컨벤션: :company/:plantCd 바인드는 각 1회만 등장해야 한다(서비스가 배열 위치 바인드로 넘김).
 */
import { PRODUCTION_ISSUE_TYPE_VALUES } from '@harness/shared';
import { listKnownMenuCodes } from '../../../menu-categories/utils/menu-code-validator';
import type { ValidationRule } from './validation-rule.types';

const PRODUCTION_ISSUE_TYPE_SQL_LIST = PRODUCTION_ISSUE_TYPE_VALUES.map((v) => `'${v}'`).join(', ');
const KNOWN_MENU_CODE_SQL_LIST = listKnownMenuCodes().map((c) => `'${c}'`).join(', ');

export const TXN_INVARIANT_RULES: ValidationRule[] = [
  {
    id: 'TXN-PROD-001',
    category: 'TXN_INVARIANT',
    severity: 'ERROR',
    title: '작업지시 집계 ≠ 실적 합계',
    description:
      'JOB_ORDERS.GOOD_QTY/DEFECT_QTY(집계 컬럼)가 PROD_RESULTS(취소 제외) 합계와 다릅니다. ' +
      '실적 저장/취소 경로 중 refreshJobOrderQtyInTx를 거치지 않는 곳이 있다는 신호입니다. 키오스크 상단 진행률이 틀리게 보입니다.',
    targetPath: '/production/order',
    sql: `SELECT j.ORDER_NO AS REF_KEY, j.STATUS AS ORDER_STATUS,
                 j.GOOD_QTY AS ORDER_GOOD_QTY, NVL(r.GOOD_SUM, 0) AS RESULT_GOOD_QTY,
                 j.DEFECT_QTY AS ORDER_DEFECT_QTY, NVL(r.DEFECT_SUM, 0) AS RESULT_DEFECT_QTY
            FROM JOB_ORDERS j
            LEFT JOIN (SELECT ORDER_NO, COMPANY, PLANT_CD, SUM(GOOD_QTY) AS GOOD_SUM, SUM(DEFECT_QTY) AS DEFECT_SUM
                         FROM PROD_RESULTS
                        WHERE STATUS <> 'CANCELED'
                        GROUP BY ORDER_NO, COMPANY, PLANT_CD) r
              ON r.ORDER_NO = j.ORDER_NO AND r.COMPANY = j.COMPANY AND r.PLANT_CD = j.PLANT_CD
           WHERE j.COMPANY = :company AND j.PLANT_CD = :plantCd
             AND j.STATUS <> 'CANCELED'
             AND (NVL(j.GOOD_QTY, 0) <> NVL(r.GOOD_SUM, 0) OR NVL(j.DEFECT_QTY, 0) <> NVL(r.DEFECT_SUM, 0))`,
  },
  {
    id: 'TXN-MAT-001',
    category: 'TXN_INVARIANT',
    severity: 'ERROR',
    title: '생산 출고인데 공정재고 적재 거래 없음',
    description:
      '생산 출고(MAT_ISSUES ISSUE_TYPE=생산, DONE)인데 PROC_MAT_TRANSACTIONS에 PROC_IN(REF_TYPE=MAT_ISSUE) 거래가 없습니다. ' +
      '출고된 재고가 공정재고에 적재되지 않고 사라진 경우(단순출고 분기)입니다. 이후 실적 자동차감이 참조할 재고가 없습니다.',
    targetPath: '/material/issue',
    sql: `SELECT i.ISSUE_NO || '-' || i.SEQ AS REF_KEY, i.ISSUE_NO, i.SEQ, i.ORDER_NO, i.MAT_UID, i.ISSUE_QTY, i.ISSUE_TYPE, i.ISSUE_DATE
            FROM MAT_ISSUES i
           WHERE i.COMPANY = :company AND i.PLANT_CD = :plantCd
             AND i.STATUS = 'DONE'
             AND UPPER(i.ISSUE_TYPE) IN (${PRODUCTION_ISSUE_TYPE_SQL_LIST})
             AND NOT EXISTS (
                   SELECT 1 FROM PROC_MAT_TRANSACTIONS t
                    WHERE t.COMPANY = i.COMPANY AND t.PLANT_CD = i.PLANT_CD
                      AND t.REF_TYPE = 'MAT_ISSUE' AND t.REF_ID = i.ISSUE_NO || '-' || i.SEQ
                      AND t.TRANS_TYPE = 'PROC_IN' AND t.STATUS = 'DONE')`,
  },
  {
    id: 'TXN-MAT-002',
    category: 'TXN_INVARIANT',
    severity: 'ERROR',
    title: '공정재고 잔량 ≠ 공정재고 거래원장 합계',
    description:
      'PROC_MAT_STOCKS.QTY가 PROC_MAT_TRANSACTIONS(DONE) 부호 합계와 다르거나, 한쪽에만 존재합니다. ' +
      '잔량과 원장을 같은 트랜잭션에서 쓰지 않는 경로가 있다는 신호입니다.',
    targetPath: '/material/issue',
    sql: `SELECT x.REF_KEY AS REF_KEY, x.PROCESS_CODE, x.ITEM_CODE, x.MAT_UID, x.STOCK_QTY, x.LEDGER_QTY
            FROM (
              SELECT NVL(s.PROCESS_CODE, t.PROCESS_CODE) || '/' || NVL(s.MAT_UID, t.MAT_UID) AS REF_KEY,
                     NVL(s.PROCESS_CODE, t.PROCESS_CODE) AS PROCESS_CODE,
                     NVL(s.ITEM_CODE, t.ITEM_CODE) AS ITEM_CODE,
                     NVL(s.MAT_UID, t.MAT_UID) AS MAT_UID,
                     NVL(s.QTY, 0) AS STOCK_QTY, NVL(t.LEDGER_QTY, 0) AS LEDGER_QTY,
                     NVL(s.COMPANY, t.COMPANY) AS COMPANY, NVL(s.PLANT_CD, t.PLANT_CD) AS PLANT_CD
                FROM PROC_MAT_STOCKS s
                FULL OUTER JOIN (
                       SELECT COMPANY, PLANT_CD, PROCESS_CODE, ITEM_CODE, MAT_UID, SUM(QTY) AS LEDGER_QTY
                         FROM PROC_MAT_TRANSACTIONS
                        WHERE STATUS = 'DONE'
                        GROUP BY COMPANY, PLANT_CD, PROCESS_CODE, ITEM_CODE, MAT_UID) t
                  ON t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD AND t.PROCESS_CODE = s.PROCESS_CODE
                 AND t.ITEM_CODE = s.ITEM_CODE AND t.MAT_UID = s.MAT_UID
               WHERE NVL(s.QTY, 0) <> NVL(t.LEDGER_QTY, 0)) x
           WHERE x.COMPANY = :company AND x.PLANT_CD = :plantCd`,
  },
  {
    id: 'TXN-MAT-003',
    category: 'TXN_INVARIANT',
    severity: 'WARN',
    title: '출고요청 상태 ≠ 배분 수량',
    description:
      '출고요청 상태와 품목별 ISSUED_QTY가 맞지 않습니다: COMPLETED인데 미충족 품목이 있거나, APPROVED/PARTIAL인데 전 품목 충족이거나, ' +
      '배분량이 요청량을 초과합니다. 출고 경로(그리드/스캔) 중 요청 배분을 건너뛰는 곳이 있다는 신호입니다.',
    targetPath: '/material/issue',
    sql: `SELECT r.REQUEST_NO AS REF_KEY, r.STATUS AS REQUEST_STATUS, r.ORDER_NO,
                 SUM(it.REQUEST_QTY) AS REQUEST_QTY, SUM(it.ISSUED_QTY) AS ISSUED_QTY,
                 SUM(CASE WHEN NVL(it.ISSUED_QTY, 0) < it.REQUEST_QTY THEN 1 ELSE 0 END) AS SHORT_ITEMS,
                 SUM(CASE WHEN NVL(it.ISSUED_QTY, 0) > it.REQUEST_QTY THEN 1 ELSE 0 END) AS OVER_ITEMS
            FROM MAT_ISSUE_REQUESTS r
            JOIN MAT_ISSUE_REQUEST_ITEMS it
              ON it.REQUEST_ID = r.REQUEST_NO AND it.COMPANY = r.COMPANY AND it.PLANT_CD = r.PLANT_CD
           WHERE r.COMPANY = :company AND r.PLANT_CD = :plantCd
           GROUP BY r.REQUEST_NO, r.STATUS, r.ORDER_NO
          HAVING (r.STATUS = 'COMPLETED' AND SUM(CASE WHEN NVL(it.ISSUED_QTY, 0) < it.REQUEST_QTY THEN 1 ELSE 0 END) > 0)
              OR (r.STATUS IN ('APPROVED', 'PARTIAL') AND SUM(CASE WHEN NVL(it.ISSUED_QTY, 0) < it.REQUEST_QTY THEN 1 ELSE 0 END) = 0)
              OR SUM(CASE WHEN NVL(it.ISSUED_QTY, 0) > it.REQUEST_QTY THEN 1 ELSE 0 END) > 0`,
  },
  {
    id: 'TXN-MENU-001',
    category: 'TXN_INVARIANT',
    severity: 'ERROR',
    title: 'DB 메뉴코드가 서버 검증 목록에 없음',
    description:
      'MENU_CATEGORY_ITEMS의 메뉴코드가 menu-code-validator 화이트리스트에 없습니다. 즐겨찾기/메뉴 카테고리 API에서 ' +
      '"알 수 없는 메뉴 코드" 오류가 납니다. 검증기·menuConfig.ts·menu-config.json에 같은 코드를 등록하세요(아키텍처 테스트 menu-code-sources.spec).',
    targetPath: '/system/menu-categories',
    sql: `SELECT m.MENU_CODE AS REF_KEY, m.CATEGORY_CODE, m.SORT_ORDER
            FROM MENU_CATEGORY_ITEMS m
           WHERE m.COMPANY = :company AND m.PLANT_CD = :plantCd
             AND m.MENU_CODE NOT IN (${KNOWN_MENU_CODE_SQL_LIST})`,
  },
];
