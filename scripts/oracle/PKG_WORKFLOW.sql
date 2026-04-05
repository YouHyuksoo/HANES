/**
 * @file PKG_WORKFLOW.sql
 * @description 워크플로우 페이지에 필요한 단계별 건수 통계를 제공하는 Oracle 패키지.
 *              SP_WORKFLOW_SUMMARY 프로시저로 7개 워크플로우 × N개 노드의 건수를 한번에 반환.
 *
 * @author  지성솔루션컨설팅
 * @created 2026-04-04
 */

--------------------------------------------------------------------------------
-- PACKAGE SPEC
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE PKG_WORKFLOW AS

    /**
     * SP_WORKFLOW_SUMMARY - 워크플로우 전체 노드별 건수 조회
     * @param o_cursor OUT SYS_REFCURSOR
     *   WORKFLOW_ID, NODE_ID, PENDING_CNT, ACTIVE_CNT, DONE_CNT, REVERSE_CNT
     */
    PROCEDURE SP_WORKFLOW_SUMMARY(
        o_cursor OUT SYS_REFCURSOR
    );

END PKG_WORKFLOW;
/

--------------------------------------------------------------------------------
-- PACKAGE BODY
--------------------------------------------------------------------------------
CREATE OR REPLACE PACKAGE BODY PKG_WORKFLOW AS

    PROCEDURE SP_WORKFLOW_SUMMARY(
        o_cursor OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN o_cursor FOR
        -- 자재관리: 입하
        SELECT 'MATERIAL' AS WORKFLOW_ID, 'ARRIVAL' AS NODE_ID,
               COUNT(CASE WHEN STATUS IN ('ARRIVED','PENDING') THEN 1 END) AS PENDING_CNT,
               COUNT(CASE WHEN STATUS = 'IQC' THEN 1 END) AS ACTIVE_CNT,
               COUNT(CASE WHEN STATUS = 'RECEIVED' THEN 1 END) AS DONE_CNT,
               0 AS REVERSE_CNT
          FROM MAT_ARRIVALS
         WHERE TRUNC(ARRIVAL_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 자재관리: IQC
        SELECT 'MATERIAL', 'IQC',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' AND RESULT = 'PASS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' AND RESULT = 'FAIL' THEN 1 END)
          FROM IQC_LOGS
         WHERE TRUNC(INSPECT_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 자재관리: 입고
        SELECT 'MATERIAL', 'RECEIVE',
               0,
               COUNT(CASE WHEN TRANS_TYPE = 'RECEIVE' AND STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN TRANS_TYPE = 'RECEIVE' AND STATUS = 'COMPLETED' THEN 1 END),
               COUNT(CASE WHEN TRANS_TYPE = 'CANCEL_RECEIVE' THEN 1 END)
          FROM STOCK_TRANSACTIONS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 생산관리: 작업지시
        SELECT 'PRODUCTION', 'ORDER',
               COUNT(CASE WHEN STATUS IN ('WAITING','WAIT') THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('START','RUNNING') THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('DONE','COMPLETED') THEN 1 END),
               0
          FROM JOB_ORDERS
         WHERE TRUNC(PLAN_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: PM
        SELECT 'EQUIPMENT', 'PM_PLAN',
               COUNT(CASE WHEN STATUS = 'PLANNED' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'CANCELLED' THEN 1 END)
          FROM PM_WORK_ORDERS
         WHERE TRUNC(SCHEDULED_DATE) = TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: 일상점검
        SELECT 'EQUIPMENT', 'DAILY',
               COUNT(CASE WHEN l.OVERALL_RESULT IS NULL THEN 1 END),
               0,
               COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL THEN 1 END),
               0
          FROM (SELECT DISTINCT EQUIP_CODE FROM EQUIP_INSPECT_ITEM_MASTERS WHERE INSPECT_TYPE='DAILY' AND USE_YN='Y') t
          LEFT JOIN EQUIP_INSPECT_LOGS l ON t.EQUIP_CODE=l.EQUIP_CODE AND l.INSPECT_TYPE='DAILY' AND TRUNC(l.INSPECT_DATE)=TRUNC(SYSDATE)

        UNION ALL
        -- 설비관리: 정기점검
        SELECT 'EQUIPMENT', 'PERIODIC',
               COUNT(CASE WHEN l.OVERALL_RESULT IS NULL THEN 1 END),
               0,
               COUNT(CASE WHEN l.OVERALL_RESULT IS NOT NULL THEN 1 END),
               0
          FROM (SELECT DISTINCT EQUIP_CODE FROM EQUIP_INSPECT_ITEM_MASTERS WHERE INSPECT_TYPE='PERIODIC' AND USE_YN='Y') t
          LEFT JOIN EQUIP_INSPECT_LOGS l ON t.EQUIP_CODE=l.EQUIP_CODE AND l.INSPECT_TYPE='PERIODIC' AND TRUNC(l.INSPECT_DATE)=TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: OQC
        SELECT 'SHIPPING', 'OQC',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'IN_PROGRESS' THEN 1 END),
               COUNT(CASE WHEN STATUS = 'COMPLETED' THEN 1 END),
               0
          FROM OQC_REQUESTS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: 출하확정
        SELECT 'SHIPPING', 'CONFIRM',
               COUNT(CASE WHEN STATUS = 'PENDING' THEN 1 END),
               0,
               COUNT(CASE WHEN STATUS IN ('SHIPPED','COMPLETED') THEN 1 END),
               0
          FROM SHIPMENT_ORDERS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 출하관리: 출하이력
        SELECT 'SHIPPING', 'HISTORY',
               0, 0,
               COUNT(*),
               0
          FROM SHIPMENT_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 품질관리: 불량
        SELECT 'QUALITY', 'DEFECT',
               COUNT(CASE WHEN STATUS = 'WAIT' THEN 1 END),
               COUNT(CASE WHEN STATUS IN ('REPAIR','REWORK') THEN 1 END),
               COUNT(CASE WHEN STATUS = 'DONE' THEN 1 END),
               0
          FROM DEFECT_LOGS
         WHERE TRUNC(OCCUR_TIME) = TRUNC(SYSDATE)

        UNION ALL
        -- 소모품: 입출고
        SELECT 'CONSUMABLES', 'RECEIVING',
               0,
               COUNT(CASE WHEN LOG_TYPE = 'IN' THEN 1 END),
               COUNT(CASE WHEN LOG_TYPE = 'OUT' THEN 1 END),
               0
          FROM CONSUMABLE_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)

        UNION ALL
        -- 소모품: 장착
        SELECT 'CONSUMABLES', 'MOUNT',
               0, 0,
               COUNT(*),
               0
          FROM CONSUMABLE_MOUNT_LOGS
         WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)
        ;

    END SP_WORKFLOW_SUMMARY;

END PKG_WORKFLOW;
/
