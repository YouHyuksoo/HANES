/**
 * @file PKG_DASHBOARD.sql
 * @description 대시보드 화면에 필요한 통계/KPI/최근 생산 데이터를 제공하는 Oracle 패키지.
 *              9개 프로시저로 구성되며, 각각 SYS_REFCURSOR를 통해 결과를 반환한다.
 *
 * @author  지성솔루션컨설팅
 * @created 2026-03-14
 *
 * @change-history
 *   날짜         작성자              내용
 *   ----------   -----------------   ------------------------------------------
 *   2026-03-14   지성솔루션컨설팅     최초 작성
 */

--------------------------------------------------------------------------------
-- PACKAGE SPEC
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE PKG_DASHBOARD AS

    /**
     * SP_EQUIP_STATS - 설비 현황 통계
     * @description 사용 중인 설비(USE_YN='Y')를 STATUS별로 집계하여 단일 행 반환
     * @param o_cursor OUT SYS_REFCURSOR - NORMAL_CNT, MAINT_CNT, STOP_CNT, TOTAL_CNT
     * @references EQUIP_MASTERS
     */
    PROCEDURE SP_EQUIP_STATS(
        o_cursor OUT SYS_REFCURSOR
    );

    /**
     * SP_JOB_ORDER_STATS - 작업지시 현황 통계
     * @description 지정일자의 작업지시를 STATUS별로 집계하여 단일 행 반환
     * @param p_target_date IN DATE - 조회 대상일 (기본값: 오늘)
     * @param o_cursor OUT SYS_REFCURSOR - WAIT_CNT, RUNNING_CNT, DONE_CNT, TOTAL_CNT
     * @references JOB_ORDERS
     */
    PROCEDURE SP_JOB_ORDER_STATS(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_cursor      OUT SYS_REFCURSOR
    );

    /**
     * SP_MAT_ALERT - 자재 알림 통계
     * @description 안전재고 미달, 유통기한 임박(7일 이내), 유통기한 초과 건수를 단일 행 반환
     * @param o_cursor OUT SYS_REFCURSOR - LOW_STOCK_CNT, NEAR_EXPIRY_CNT, EXPIRED_CNT, TOTAL_CNT
     * @references MAT_STOCKS, ITEM_MASTERS, MAT_LOTS
     */
    PROCEDURE SP_MAT_ALERT(
        o_cursor OUT SYS_REFCURSOR
    );

    /**
     * SP_DEFECT_STATS - 불량 현황 통계
     * @description 불량 로그를 STATUS별로 집계하여 단일 행 반환
     * @param o_cursor OUT SYS_REFCURSOR - WAIT_CNT, REPAIR_CNT, REWORK_CNT, DONE_CNT, TOTAL_CNT
     * @references DEFECT_LOGS
     */
    PROCEDURE SP_DEFECT_STATS(
        o_cursor OUT SYS_REFCURSOR
    );

    /**
     * SP_INSPECT_DAILY - 일상점검 현황
     * @description 일상점검 대상 설비 목록과 점검 완료/결과를 요약·상세로 반환
     * @param p_target_date IN DATE  - 조회 대상일 (기본값: 오늘)
     * @param o_summary     OUT SYS_REFCURSOR - TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT
     * @param o_items       OUT SYS_REFCURSOR - EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE
     * @references EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_LOGS, EQUIP_MASTERS
     */
    PROCEDURE SP_INSPECT_DAILY(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    );

    /**
     * SP_INSPECT_PERIODIC - 정기점검 현황
     * @description 정기점검 대상 설비 목록과 점검 완료/결과를 요약·상세로 반환
     * @param p_target_date IN DATE  - 조회 대상일 (기본값: 오늘)
     * @param o_summary     OUT SYS_REFCURSOR - TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT
     * @param o_items       OUT SYS_REFCURSOR - EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE
     * @references EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_LOGS, EQUIP_MASTERS
     */
    PROCEDURE SP_INSPECT_PERIODIC(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    );

    /**
     * SP_INSPECT_PM - 예방보전(PM) 점검 현황
     * @description PM 작업지시 기반으로 대상 설비 목록과 완료/결과를 요약·상세로 반환
     * @param p_target_date IN DATE  - 조회 대상일 (기본값: 오늘)
     * @param o_summary     OUT SYS_REFCURSOR - TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT
     * @param o_items       OUT SYS_REFCURSOR - EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE
     * @references PM_WORK_ORDERS, EQUIP_MASTERS
     */
    PROCEDURE SP_INSPECT_PM(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    );

    /**
     * SP_KPI - 핵심 성과지표 (KPI)
     * @description 금일/전일 생산량, 재고 총량, 합격률, 불량 건수 및 변화율을 단일 행 반환
     * @param o_cursor OUT SYS_REFCURSOR - TODAY_PROD, YESTERDAY_PROD, PROD_CHANGE,
     *                                     INVENTORY_TOTAL, INV_CHANGE,
     *                                     PASS_RATE, RATE_CHANGE,
     *                                     DEFECT_CNT, DEFECT_CHANGE
     * @references JOB_ORDERS, MAT_STOCKS, INSPECT_RESULTS, DEFECT_LOGS
     */
    PROCEDURE SP_KPI(
        o_cursor OUT SYS_REFCURSOR
    );

    /**
     * SP_RECENT_PRODUCTIONS - 최근 생산 실적 (최신 10건)
     * @description 작업지시를 최신순으로 10건 조회하여 반환
     * @param o_cursor OUT SYS_REFCURSOR - ORDER_NO, ITEM_NAME, LINE, PLAN_QTY, ACTUAL_QTY,
     *                                     PROGRESS, STATUS
     * @references JOB_ORDERS, ITEM_MASTERS
     */
    PROCEDURE SP_RECENT_PRODUCTIONS(
        o_cursor OUT SYS_REFCURSOR
    );

END PKG_DASHBOARD;
/

--------------------------------------------------------------------------------
-- PACKAGE BODY
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE BODY PKG_DASHBOARD AS

    ----------------------------------------------------------------------------
    -- SP_EQUIP_STATS: 설비 현황 통계
    -- EQUIP_MASTERS에서 USE_YN='Y'인 설비를 STATUS별로 카운트
    -- NORMAL / MAINT(유지보수) / STOP(정지) 3가지로 분류
    ----------------------------------------------------------------------------
    PROCEDURE SP_EQUIP_STATS(
        o_cursor OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
            SELECT
                -- 정상 가동 중인 설비 수
                COUNT(CASE WHEN STATUS = 'NORMAL' THEN 1 END)  AS NORMAL_CNT,
                -- 유지보수 중인 설비 수
                COUNT(CASE WHEN STATUS = 'MAINT'  THEN 1 END)  AS MAINT_CNT,
                -- 정지 상태 설비 수
                COUNT(CASE WHEN STATUS = 'STOP'   THEN 1 END)  AS STOP_CNT,
                -- 전체 사용 설비 수
                COUNT(*)                                        AS TOTAL_CNT
            FROM EQUIP_MASTERS
            WHERE USE_YN = 'Y';
    END SP_EQUIP_STATS;

    ----------------------------------------------------------------------------
    -- SP_JOB_ORDER_STATS: 작업지시 현황 통계
    -- 지정일자의 작업지시를 대기/진행/완료로 분류하여 카운트
    -- STATUS 값 매핑: WAITING|WAIT → 대기, START|RUNNING → 진행, DONE|COMPLETED → 완료
    ----------------------------------------------------------------------------
    PROCEDURE SP_JOB_ORDER_STATS(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_cursor      OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
            SELECT
                -- 대기 상태 건수 (WAITING 또는 WAIT)
                COUNT(CASE WHEN STATUS IN ('WAITING', 'WAIT')       THEN 1 END) AS WAIT_CNT,
                -- 진행 중 건수 (START 또는 RUNNING)
                COUNT(CASE WHEN STATUS IN ('START', 'RUNNING')      THEN 1 END) AS RUNNING_CNT,
                -- 완료 건수 (DONE 또는 COMPLETED)
                COUNT(CASE WHEN STATUS IN ('DONE', 'COMPLETED')     THEN 1 END) AS DONE_CNT,
                -- 전체 건수
                COUNT(*)                                                         AS TOTAL_CNT
            FROM JOB_ORDERS
            WHERE TRUNC(PLAN_DATE) = TRUNC(p_target_date);
    END SP_JOB_ORDER_STATS;

    ----------------------------------------------------------------------------
    -- SP_MAT_ALERT: 자재 알림 통계
    -- 1) 안전재고 미달: MAT_STOCKS.QTY < ITEM_MASTERS.SAFETY_STOCK
    -- 2) 유통기한 임박: 오늘~7일 이내 만료 예정
    -- 3) 유통기한 초과: 이미 만료된 자재
    ----------------------------------------------------------------------------
    PROCEDURE SP_MAT_ALERT(
        o_cursor OUT SYS_REFCURSOR
    ) IS
        v_low_stock    NUMBER := 0;
        v_near_expiry  NUMBER := 0;
        v_expired      NUMBER := 0;
    BEGIN
        -- 안전재고 미달 건수
        SELECT COUNT(*)
          INTO v_low_stock
          FROM MAT_STOCKS s
          JOIN ITEM_MASTERS i ON s.ITEM_CODE = i.ITEM_CODE
         WHERE s.QTY < i.SAFETY_STOCK
           AND i.SAFETY_STOCK > 0;

        -- 유통기한 임박 건수 (7일 이내)
        SELECT COUNT(*)
          INTO v_near_expiry
          FROM MAT_LOTS
         WHERE EXPIRE_DATE IS NOT NULL
           AND STATUS NOT IN ('DEPLETED', 'SCRAPPED')
           AND EXPIRE_DATE BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 7;

        -- 유통기한 초과 건수
        SELECT COUNT(*)
          INTO v_expired
          FROM MAT_LOTS
         WHERE EXPIRE_DATE IS NOT NULL
           AND STATUS NOT IN ('DEPLETED', 'SCRAPPED')
           AND EXPIRE_DATE < TRUNC(SYSDATE);

        OPEN o_cursor FOR
            SELECT
                v_low_stock                                  AS LOW_STOCK_CNT,
                v_near_expiry                                AS NEAR_EXPIRY_CNT,
                v_expired                                    AS EXPIRED_CNT,
                (v_low_stock + v_near_expiry + v_expired)    AS TOTAL_CNT
            FROM DUAL;
    END SP_MAT_ALERT;

    ----------------------------------------------------------------------------
    -- SP_DEFECT_STATS: 불량 현황 통계
    -- DEFECT_LOGS를 STATUS별로 카운트
    -- WAIT(대기), REPAIR(수리), REWORK(재작업), DONE(완료)
    ----------------------------------------------------------------------------
    PROCEDURE SP_DEFECT_STATS(
        o_cursor OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
            SELECT
                COUNT(CASE WHEN STATUS = 'WAIT'   THEN 1 END) AS WAIT_CNT,
                COUNT(CASE WHEN STATUS = 'REPAIR'  THEN 1 END) AS REPAIR_CNT,
                COUNT(CASE WHEN STATUS = 'REWORK'  THEN 1 END) AS REWORK_CNT,
                COUNT(CASE WHEN STATUS = 'DONE'    THEN 1 END) AS DONE_CNT,
                COUNT(*)                                        AS TOTAL_CNT
            FROM DEFECT_LOGS;
    END SP_DEFECT_STATS;

    ----------------------------------------------------------------------------
    -- SP_INSPECT_DAILY: 일상점검 현황
    -- EQUIP_INSPECT_ITEM_MASTERS에서 DAILY 점검 대상 설비를 추출하고,
    -- EQUIP_INSPECT_LOGS에서 해당일 점검 결과를 LEFT JOIN하여 요약·상세 반환
    ----------------------------------------------------------------------------
    PROCEDURE SP_INSPECT_DAILY(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    ) IS
    BEGIN
        -- 요약 커서: 전체/완료/합격/불합격 건수
        OPEN o_summary FOR
            SELECT
                COUNT(*)                                                           AS TOTAL_CNT,
                COUNT(l.OVERALL_RESULT)                                            AS COMPLETED_CNT,
                COUNT(CASE WHEN l.OVERALL_RESULT = 'PASS' THEN 1 END)             AS PASS_CNT,
                COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL
                            AND l.OVERALL_RESULT <> 'PASS' THEN 1 END)            AS FAIL_CNT
            FROM (
                -- 일상점검 대상 설비 목록 (설비별 1건으로 그룹핑)
                SELECT DISTINCT EQUIP_CODE
                  FROM EQUIP_INSPECT_ITEM_MASTERS
                 WHERE INSPECT_TYPE = 'DAILY'
                   AND USE_YN = 'Y'
            ) t
            LEFT JOIN EQUIP_INSPECT_LOGS l
              ON t.EQUIP_CODE    = l.EQUIP_CODE
             AND l.INSPECT_TYPE  = 'DAILY'
             AND TRUNC(l.INSPECT_DATE) = TRUNC(p_target_date);

        -- 상세 커서: 설비별 점검 결과
        OPEN o_items FOR
            SELECT
                t.EQUIP_CODE,
                e.EQUIP_NAME,
                l.OVERALL_RESULT  AS RESULT,          -- 미점검이면 NULL
                l.INSPECTOR_NAME,
                e.LINE_CODE
            FROM (
                SELECT DISTINCT EQUIP_CODE
                  FROM EQUIP_INSPECT_ITEM_MASTERS
                 WHERE INSPECT_TYPE = 'DAILY'
                   AND USE_YN = 'Y'
            ) t
            LEFT JOIN EQUIP_INSPECT_LOGS l
              ON t.EQUIP_CODE    = l.EQUIP_CODE
             AND l.INSPECT_TYPE  = 'DAILY'
             AND TRUNC(l.INSPECT_DATE) = TRUNC(p_target_date)
            LEFT JOIN EQUIP_MASTERS e
              ON t.EQUIP_CODE = e.EQUIP_CODE
            ORDER BY t.EQUIP_CODE;
    END SP_INSPECT_DAILY;

    ----------------------------------------------------------------------------
    -- SP_INSPECT_PERIODIC: 정기점검 현황
    -- SP_INSPECT_DAILY와 동일 로직, INSPECT_TYPE='PERIODIC'
    ----------------------------------------------------------------------------
    PROCEDURE SP_INSPECT_PERIODIC(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    ) IS
    BEGIN
        -- 요약 커서
        OPEN o_summary FOR
            SELECT
                COUNT(*)                                                           AS TOTAL_CNT,
                COUNT(l.OVERALL_RESULT)                                            AS COMPLETED_CNT,
                COUNT(CASE WHEN l.OVERALL_RESULT = 'PASS' THEN 1 END)             AS PASS_CNT,
                COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL
                            AND l.OVERALL_RESULT <> 'PASS' THEN 1 END)            AS FAIL_CNT
            FROM (
                -- 정기점검 대상 설비 목록
                SELECT DISTINCT EQUIP_CODE
                  FROM EQUIP_INSPECT_ITEM_MASTERS
                 WHERE INSPECT_TYPE = 'PERIODIC'
                   AND USE_YN = 'Y'
            ) t
            LEFT JOIN EQUIP_INSPECT_LOGS l
              ON t.EQUIP_CODE    = l.EQUIP_CODE
             AND l.INSPECT_TYPE  = 'PERIODIC'
             AND TRUNC(l.INSPECT_DATE) = TRUNC(p_target_date);

        -- 상세 커서
        OPEN o_items FOR
            SELECT
                t.EQUIP_CODE,
                e.EQUIP_NAME,
                l.OVERALL_RESULT  AS RESULT,
                l.INSPECTOR_NAME,
                e.LINE_CODE
            FROM (
                SELECT DISTINCT EQUIP_CODE
                  FROM EQUIP_INSPECT_ITEM_MASTERS
                 WHERE INSPECT_TYPE = 'PERIODIC'
                   AND USE_YN = 'Y'
            ) t
            LEFT JOIN EQUIP_INSPECT_LOGS l
              ON t.EQUIP_CODE    = l.EQUIP_CODE
             AND l.INSPECT_TYPE  = 'PERIODIC'
             AND TRUNC(l.INSPECT_DATE) = TRUNC(p_target_date)
            LEFT JOIN EQUIP_MASTERS e
              ON t.EQUIP_CODE = e.EQUIP_CODE
            ORDER BY t.EQUIP_CODE;
    END SP_INSPECT_PERIODIC;

    ----------------------------------------------------------------------------
    -- SP_INSPECT_PM: 예방보전(PM) 점검 현황
    -- PM_WORK_ORDERS 기반으로 해당일 예정된 PM 작업의 완료/결과를 조회
    -- STATUS가 'COMPLETED'이면 OVERALL_RESULT(없으면 'COMPLETED')을 RESULT로 반환
    ----------------------------------------------------------------------------
    PROCEDURE SP_INSPECT_PM(
        p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
        o_summary     OUT SYS_REFCURSOR,
        o_items       OUT SYS_REFCURSOR
    ) IS
    BEGIN
        -- 요약 커서
        OPEN o_summary FOR
            SELECT
                COUNT(*)                                                              AS TOTAL_CNT,
                -- 완료된 PM 건수
                COUNT(CASE WHEN wo.STATUS = 'COMPLETED' THEN 1 END)                  AS COMPLETED_CNT,
                -- 합격: 완료 + OVERALL_RESULT가 'PASS'
                COUNT(CASE WHEN wo.STATUS = 'COMPLETED'
                            AND NVL(wo.OVERALL_RESULT, 'COMPLETED') = 'PASS'
                       THEN 1 END)                                                    AS PASS_CNT,
                -- 불합격: 완료 + OVERALL_RESULT가 'PASS'가 아닌 경우
                COUNT(CASE WHEN wo.STATUS = 'COMPLETED'
                            AND NVL(wo.OVERALL_RESULT, 'COMPLETED') <> 'PASS'
                       THEN 1 END)                                                    AS FAIL_CNT
            FROM PM_WORK_ORDERS wo
            WHERE TRUNC(wo.SCHEDULED_DATE) = TRUNC(p_target_date);

        -- 상세 커서
        OPEN o_items FOR
            SELECT
                wo.EQUIP_CODE,
                e.EQUIP_NAME,
                -- 완료 시 OVERALL_RESULT 반환 (없으면 'COMPLETED'), 미완료 시 NULL
                CASE
                    WHEN wo.STATUS = 'COMPLETED'
                    THEN NVL(wo.OVERALL_RESULT, 'COMPLETED')
                    ELSE NULL
                END                     AS RESULT,
                NULL                    AS INSPECTOR_NAME,   -- PM에는 점검자 정보 없음
                e.LINE_CODE
            FROM PM_WORK_ORDERS wo
            LEFT JOIN EQUIP_MASTERS e
              ON wo.EQUIP_CODE = e.EQUIP_CODE
            WHERE TRUNC(wo.SCHEDULED_DATE) = TRUNC(p_target_date)
            ORDER BY wo.EQUIP_CODE;
    END SP_INSPECT_PM;

    ----------------------------------------------------------------------------
    -- SP_KPI: 핵심 성과지표 (KPI)
    -- 금일/전일 비교를 통한 생산량, 재고, 합격률, 불량 건수 및 변화율 산출
    -- 변화율 계산: 전일 값 > 0 이면 ROUND(((금일 - 전일) / 전일) * 100), 아니면 0
    ----------------------------------------------------------------------------
    PROCEDURE SP_KPI(
        o_cursor OUT SYS_REFCURSOR
    ) IS
        v_today_prod      NUMBER := 0;   -- 금일 생산량
        v_yesterday_prod  NUMBER := 0;   -- 전일 생산량
        v_inventory_total NUMBER := 0;   -- 재고 총량
        v_today_pass      NUMBER := 0;   -- 금일 합격 건수
        v_today_total_insp NUMBER := 0;  -- 금일 검사 총 건수
        v_yest_pass       NUMBER := 0;   -- 전일 합격 건수
        v_yest_total_insp NUMBER := 0;   -- 전일 검사 총 건수
        v_pass_rate       NUMBER := 0;   -- 금일 합격률
        v_yest_pass_rate  NUMBER := 0;   -- 전일 합격률
        v_defect_cnt      NUMBER := 0;   -- 금일 불량 건수
        v_yest_defect_cnt NUMBER := 0;   -- 전일 불량 건수
    BEGIN
        -----------------------------------------------------------------------
        -- 1) 금일/전일 생산량 (JOB_ORDERS.GOOD_QTY 합계)
        -----------------------------------------------------------------------
        SELECT
            NVL(SUM(CASE WHEN TRUNC(PLAN_DATE) = TRUNC(SYSDATE)     THEN GOOD_QTY ELSE 0 END), 0),
            NVL(SUM(CASE WHEN TRUNC(PLAN_DATE) = TRUNC(SYSDATE) - 1 THEN GOOD_QTY ELSE 0 END), 0)
          INTO v_today_prod, v_yesterday_prod
          FROM JOB_ORDERS
         WHERE TRUNC(PLAN_DATE) IN (TRUNC(SYSDATE), TRUNC(SYSDATE) - 1);

        -----------------------------------------------------------------------
        -- 2) 재고 총량 (MAT_STOCKS.QTY 합계)
        -----------------------------------------------------------------------
        SELECT NVL(SUM(QTY), 0)
          INTO v_inventory_total
          FROM MAT_STOCKS;

        -----------------------------------------------------------------------
        -- 3) 합격률 (INSPECT_RESULTS 금일/전일 비교)
        --    합격률 = (PASS_YN='Y' 건수 / 전체 건수) * 100
        -----------------------------------------------------------------------
        SELECT
            COUNT(CASE WHEN PASS_YN = 'Y' THEN 1 END),
            COUNT(*)
          INTO v_today_pass, v_today_total_insp
          FROM INSPECT_RESULTS
         WHERE TRUNC(INSPECT_TIME) = TRUNC(SYSDATE);

        SELECT
            COUNT(CASE WHEN PASS_YN = 'Y' THEN 1 END),
            COUNT(*)
          INTO v_yest_pass, v_yest_total_insp
          FROM INSPECT_RESULTS
         WHERE TRUNC(INSPECT_TIME) = TRUNC(SYSDATE) - 1;

        -- 합격률 계산
        IF v_today_total_insp > 0 THEN
            v_pass_rate := ROUND((v_today_pass / v_today_total_insp) * 100, 1);
        ELSE
            v_pass_rate := 0;
        END IF;

        IF v_yest_total_insp > 0 THEN
            v_yest_pass_rate := ROUND((v_yest_pass / v_yest_total_insp) * 100, 1);
        ELSE
            v_yest_pass_rate := 0;
        END IF;

        -----------------------------------------------------------------------
        -- 4) 불량 건수 (DEFECT_LOGS 금일/전일 비교)
        -----------------------------------------------------------------------
        SELECT COUNT(*)
          INTO v_defect_cnt
          FROM DEFECT_LOGS
         WHERE TRUNC(OCCUR_TIME) = TRUNC(SYSDATE);

        SELECT COUNT(*)
          INTO v_yest_defect_cnt
          FROM DEFECT_LOGS
         WHERE TRUNC(OCCUR_TIME) = TRUNC(SYSDATE) - 1;

        -----------------------------------------------------------------------
        -- 결과 커서 반환 (변화율 계산 포함)
        -----------------------------------------------------------------------
        OPEN o_cursor FOR
            SELECT
                v_today_prod        AS TODAY_PROD,
                v_yesterday_prod    AS YESTERDAY_PROD,
                -- 생산량 변화율
                CASE WHEN v_yesterday_prod > 0
                     THEN ROUND(((v_today_prod - v_yesterday_prod) / v_yesterday_prod) * 100)
                     ELSE 0
                END                 AS PROD_CHANGE,
                v_inventory_total   AS INVENTORY_TOTAL,
                -- 재고 변화율 (비교 대상 없으므로 0 고정)
                0                   AS INV_CHANGE,
                v_pass_rate         AS PASS_RATE,
                -- 합격률 변화 (전일 합격률과의 차이)
                CASE WHEN v_yest_pass_rate > 0
                     THEN ROUND(((v_pass_rate - v_yest_pass_rate) / v_yest_pass_rate) * 100)
                     ELSE 0
                END                 AS RATE_CHANGE,
                v_defect_cnt        AS DEFECT_CNT,
                -- 불량 건수 변화율
                CASE WHEN v_yest_defect_cnt > 0
                     THEN ROUND(((v_defect_cnt - v_yest_defect_cnt) / v_yest_defect_cnt) * 100)
                     ELSE 0
                END                 AS DEFECT_CHANGE
            FROM DUAL;
    END SP_KPI;

    ----------------------------------------------------------------------------
    -- SP_RECENT_PRODUCTIONS: 최근 생산 실적 (최신 10건)
    -- JOB_ORDERS를 CREATED_AT 내림차순으로 10건 조회
    -- LINE_CODE → LINE alias (프론트엔드 호환)
    -- PROGRESS = ROUND(GOOD_QTY / PLAN_QTY * 1000) / 10 (소수 첫째자리)
    ----------------------------------------------------------------------------
    PROCEDURE SP_RECENT_PRODUCTIONS(
        o_cursor OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
            SELECT
                jo.ORDER_NO,
                NVL(i.ITEM_NAME, '-')                    AS ITEM_NAME,
                NVL(jo.LINE_CODE, '-')                   AS LINE,           -- 프론트엔드 호환용 alias
                jo.PLAN_QTY,
                jo.GOOD_QTY                              AS ACTUAL_QTY,
                -- 진행률: 소수 첫째자리까지 (0~100%)
                CASE
                    WHEN jo.PLAN_QTY > 0
                    THEN ROUND(jo.GOOD_QTY / jo.PLAN_QTY * 1000) / 10
                    ELSE 0
                END                                      AS PROGRESS,
                -- STATUS 정규화: WAITING → WAIT
                CASE
                    WHEN jo.STATUS = 'WAITING' THEN 'WAIT'
                    ELSE jo.STATUS
                END                                      AS STATUS
            FROM JOB_ORDERS jo
            LEFT JOIN ITEM_MASTERS i
              ON jo.ITEM_CODE = i.ITEM_CODE
            ORDER BY jo.CREATED_AT DESC
            FETCH FIRST 10 ROWS ONLY;
    END SP_RECENT_PRODUCTIONS;

END PKG_DASHBOARD;
/
