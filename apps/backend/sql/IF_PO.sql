-- ERP PO 인터페이스 프로시저
-- 대상: PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS (COMPANY='40', PLANT_CD='1000')
-- 소스: XXPO_MES_ORAERP_PO_V@ERP_PROD (ORGANIZATION_ID=308, OSP_TYPE='N')
-- 변경 감지: 없음 (매번 MERGE 수행)
-- 주의: 이미 입고된 라인(RECEIVED_QTY>0)은 품번/발주수량 변경 불가
-- 주의: PARTNER_CODE는 ERP VENDOR_ID를 1:1 매핑하나, FK 제약 위반이 발생할 수 있으므로
--       실제 운영 시 PARTNER_MASTERS에 해당 거래처가 사전 등록되어 있어야 함
-- 주의: PURCHASE_ORDER_ITEMS.SEQ = ERP LINE_NO, REL_NO = ERP REL_NO (Schedule Release)
CREATE OR REPLACE PROCEDURE IF_PO(
    N_RETURN  OUT NUMBER,
    V_RETURN  OUT VARCHAR2,
    N_INSERT  OUT NUMBER,
    N_UPDATE  OUT NUMBER
)
IS
    V_PO_BEFORE   NUMBER;
    V_PO_AFTER    NUMBER;
    V_PO_TOTAL    NUMBER;
    V_ITEM_BEFORE NUMBER;
    V_ITEM_AFTER  NUMBER;
    V_ITEM_TOTAL  NUMBER;
    V_INSERT_PO   NUMBER;
    V_UPDATE_PO   NUMBER;
    V_INSERT_ITEM NUMBER;
    V_UPDATE_ITEM NUMBER;
BEGIN
    N_INSERT := 0;
    N_UPDATE := 0;

    -- ============================================================
    -- 1. PURCHASE_ORDERS 헤더 MERGE (UPSERT)
    -- ============================================================
    SELECT COUNT(*) INTO V_PO_BEFORE
    FROM PURCHASE_ORDERS
    WHERE COMPANY = '40' AND PLANT_CD = '1000';

    MERGE INTO PURCHASE_ORDERS T
    USING (
        SELECT
            PO_NO,
            MAX(VENDOR_NAME)     AS PARTNER_NAME,
            MIN(NEED_BY_DATE)    AS ORDER_DATE,
            MAX(NEED_BY_DATE)    AS DUE_DATE,
            MAX(VENDOR_ID)       AS PARTNER_ID
        FROM XXPO_MES_ORAERP_PO_V@ERP_PROD
        WHERE ORGANIZATION_ID = 308
          AND OSP_TYPE = 'N'
        GROUP BY PO_NO
    ) E ON (T.PO_NO = E.PO_NO AND T.COMPANY = '40' AND T.PLANT_CD = '1000')
    WHEN NOT MATCHED THEN
        INSERT (
            PO_NO, PARTNER_CODE, PARTNER_NAME, ORDER_DATE, DUE_DATE,
            STATUS, USE_TYPE, TOTAL_AMOUNT, REMARK,
            COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT
        )
        VALUES (
            E.PO_NO, E.PARTNER_ID, E.PARTNER_NAME, E.ORDER_DATE, E.DUE_DATE,
            'CONFIRMED', 'PROD', NULL, NULL,
            '40', '1000', 'ERP-IF', SYSTIMESTAMP, SYSTIMESTAMP
        )
    WHEN MATCHED THEN
        UPDATE SET
            T.PARTNER_CODE = E.PARTNER_ID,
            T.PARTNER_NAME = E.PARTNER_NAME,
            T.ORDER_DATE   = E.ORDER_DATE,
            T.DUE_DATE     = E.DUE_DATE,
            T.STATUS       = 'CONFIRMED',
            T.UPDATED_AT   = SYSTIMESTAMP;

    V_PO_TOTAL := SQL%ROWCOUNT;

    SELECT COUNT(*) INTO V_PO_AFTER
    FROM PURCHASE_ORDERS
    WHERE COMPANY = '40' AND PLANT_CD = '1000';

    V_INSERT_PO := V_PO_AFTER - V_PO_BEFORE;
    V_UPDATE_PO := V_PO_TOTAL - V_INSERT_PO;

    -- ============================================================
    -- 2. PURCHASE_ORDER_ITEMS 라인 MERGE (UPSERT)
    -- ============================================================
    SELECT COUNT(*) INTO V_ITEM_BEFORE
    FROM PURCHASE_ORDER_ITEMS
    WHERE COMPANY = '40' AND PLANT_CD = '1000';

    MERGE INTO PURCHASE_ORDER_ITEMS T
    USING (
        SELECT
            PO_NO,
            LINE_NO,
            REL_NO,
            PART_NO,
            QUANTITY,
            QUANTITY_RECEIVED,
            UNIT_PRICE,
            H_CANCEL_FLAG,
            L_CANCEL_FLAG,
            H_CLOSED_CODE,
            L_CLOSED_CODE,
            CASE
                WHEN H_CANCEL_FLAG = 'Y' OR L_CANCEL_FLAG = 'Y' THEN 'CLOSE'
                WHEN H_CLOSED_CODE != 'OPEN' OR L_CLOSED_CODE != 'OPEN' THEN 'CLOSE'
                WHEN QUANTITY_RECEIVED >= QUANTITY THEN 'CLOSE'
                WHEN QUANTITY_RECEIVED > 0 THEN 'PARTIAL'
                ELSE 'OPEN'
            END AS LINE_STATUS
        FROM XXPO_MES_ORAERP_PO_V@ERP_PROD
        WHERE ORGANIZATION_ID = 308
          AND OSP_TYPE = 'N'
    ) E ON (T.PO_ID = E.PO_NO AND T.LINE_NO = E.LINE_NO AND T.REL_NO = E.REL_NO AND T.COMPANY = '40' AND T.PLANT_CD = '1000')
    WHEN NOT MATCHED THEN
        INSERT (
            PO_ID, SEQ, ITEM_CODE, ORDER_QTY, RECEIVED_QTY,
            LINE_NO, REV_NO, LINE_STATUS, UNIT_PRICE, REL_NO, REMARK,
            COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT
        )
        VALUES (
            E.PO_NO, (E.LINE_NO * 1000 + NVL(E.REL_NO, 0)), E.PART_NO, E.QUANTITY, E.QUANTITY_RECEIVED,
            E.LINE_NO, 1, E.LINE_STATUS, E.UNIT_PRICE, E.REL_NO, NULL,
            '40', '1000', 'ERP-IF', SYSTIMESTAMP, SYSTIMESTAMP
        )
    WHEN MATCHED THEN
        UPDATE SET
            T.ITEM_CODE    = CASE WHEN T.RECEIVED_QTY = 0 THEN E.PART_NO ELSE T.ITEM_CODE END,
            T.ORDER_QTY    = CASE WHEN T.RECEIVED_QTY = 0 THEN E.QUANTITY ELSE T.ORDER_QTY END,
            T.RECEIVED_QTY = E.QUANTITY_RECEIVED,
            T.UNIT_PRICE   = E.UNIT_PRICE,
            T.LINE_STATUS  = E.LINE_STATUS,
            T.UPDATED_AT   = SYSTIMESTAMP;

    V_ITEM_TOTAL := SQL%ROWCOUNT;

    SELECT COUNT(*) INTO V_ITEM_AFTER
    FROM PURCHASE_ORDER_ITEMS
    WHERE COMPANY = '40' AND PLANT_CD = '1000';

    V_INSERT_ITEM := V_ITEM_AFTER - V_ITEM_BEFORE;
    V_UPDATE_ITEM := V_ITEM_TOTAL - V_INSERT_ITEM;

    -- ============================================================
    -- 3. 헤더 상태 재계산 (라인 상태 기반)
    --    원본 IF_PO의 2차 루프(TM_ORDERMASTER USEFLAG 집계) 대체
    -- ============================================================
    UPDATE PURCHASE_ORDERS PO
    SET
        STATUS = (
            SELECT CASE
                WHEN COUNT(*) = 0 THEN 'CONFIRMED'
                WHEN COUNT(CASE WHEN LINE_STATUS = 'CLOSE' THEN 1 END) = COUNT(*) THEN 'CLOSED'
                WHEN COUNT(CASE WHEN LINE_STATUS IN ('PARTIAL', 'CLOSE') THEN 1 END) > 0 THEN 'PARTIAL'
                ELSE 'CONFIRMED'
            END
            FROM PURCHASE_ORDER_ITEMS
            WHERE PO_ID = PO.PO_NO
              AND COMPANY = PO.COMPANY
              AND PLANT_CD = PO.PLANT_CD
        ),
        UPDATED_AT = SYSTIMESTAMP
    WHERE COMPANY = '40'
      AND PLANT_CD = '1000'
      AND PO_NO IN (
          SELECT DISTINCT PO_NO
          FROM XXPO_MES_ORAERP_PO_V@ERP_PROD
          WHERE ORGANIZATION_ID = 308
            AND OSP_TYPE = 'N'
      );

    -- ============================================================
    -- 4. 결과 집계 및 커밋
    -- ============================================================
    N_INSERT := V_INSERT_PO + V_INSERT_ITEM;
    N_UPDATE := V_UPDATE_PO + V_UPDATE_ITEM;

    COMMIT;

    N_RETURN := 0;
    V_RETURN := 'OK';

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        N_RETURN := 1;
        V_RETURN := SQLERRM;
END IF_PO;
/