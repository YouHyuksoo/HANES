-- 2026-09-14 소모품 장착관리 : 마스터(코드) 단위 → 실물 인스턴스(conUid) 단위 전환
--
-- 배경
--   그동안 장착 상태가 두 군데에 따로 기록됐다.
--     (A) CONSUMABLE_MASTERS.OPER_STATUS / MOUNTED_EQUIP_ID  ← 장착관리 화면
--     (B) CONSUMABLE_STOCKS.STATUS / MOUNTED_EQUIP_CODE      ← 현장 키오스크 스캔
--   두 경로가 서로 동기화되지 않아 "재고 5개 중 몇 개가 어느 설비에 붙었는지" 알 수 없었다.
--   이번 전환으로 (B) 실물 UID 단위로 일원화하고, (A) 는 더 이상 쓰지 않는다.
--
-- 실행 순서 : 1 → 2 → 3 → 4 (전부 한 번에 실행해도 되고, 단계별로 확인하며 실행해도 된다)
-- 실행 전 반드시 CONSUMABLE_MASTERS / CONSUMABLE_STOCKS 백업을 받을 것.

-- =====================================================================
-- 1) CONSUMABLE_STOCKS 에 수명상태 컬럼 추가
--    개체마다 마모도가 다르므로 수명 상태를 실물 단위로 관리한다.
-- =====================================================================
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'CONSUMABLE_STOCKS' AND COLUMN_NAME = 'LIFE_STATUS';
  IF v_cnt = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE CONSUMABLE_STOCKS ADD (LIFE_STATUS VARCHAR2(20) DEFAULT 'NORMAL')]';
  END IF;
END;
/

UPDATE CONSUMABLE_STOCKS SET LIFE_STATUS = 'NORMAL' WHERE LIFE_STATUS IS NULL
/

-- =====================================================================
-- 2) 공통코드 보정 : CON_STOCK_STATUS 에 PROC_WAIT(공정대기) 누락분 추가
--    공정출고 로직은 이미 PROC_WAIT 를 쓰는데 공통코드에 행이 없어 화면에서 필터가 안 잡혔다.
-- =====================================================================
MERGE INTO COM_CODES t
USING (SELECT '40' COMPANY, '1000' PLANT_CD FROM DUAL) s
   ON (t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD
       AND t.GROUP_CODE = 'CON_STOCK_STATUS' AND t.DETAIL_CODE = 'PROC_WAIT')
 WHEN NOT MATCHED THEN INSERT (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
      VALUES ('CON_STOCK_STATUS', 'PROC_WAIT', '공정대기', 6, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP)
/

-- =====================================================================
-- 3) 레거시 마스터 → 실물 인스턴스 생성 (전량 자동 생성)
--    마스터 재고수량(STOCK_QTY)만큼 conUid 를 만들되, 이미 있는 인스턴스 수는 뺀다.
--    장착중이던 마스터는 첫 인스턴스가 장착 상태와 누적 타수를 물려받는다.
--
--    ※ 주의 : 마스터의 누적 타수는 "코드 단위 합계"라 실물별로 나눌 근거가 없다.
--            첫 인스턴스에 몰아서 넣는 근사치이므로, 실물과 라벨을 맞춘 뒤
--            현장에서 소모품관리 > 타수 조정으로 보정하는 것을 전제로 한다.
-- =====================================================================
DECLARE
  v_exist   NUMBER;
  v_need    NUMBER;
  v_uid     VARCHAR2(50);
  v_first   BOOLEAN;
  v_status  VARCHAR2(20);
  v_equip   VARCHAR2(50);
  v_count   NUMBER;
  v_life    VARCHAR2(20);
  v_made    NUMBER := 0;
BEGIN
  FOR m IN (
    SELECT CONSUMABLE_CODE, NVL(STOCK_QTY, 0) AS STOCK_QTY, OPER_STATUS, MOUNTED_EQUIP_ID,
           NVL(CURRENT_COUNT, 0) AS CURRENT_COUNT, NVL(STATUS, 'NORMAL') AS STATUS,
           COMPANY, PLANT_CD, LOCATION
      FROM CONSUMABLE_MASTERS
     WHERE NVL(USE_YN, 'Y') = 'Y'
  ) LOOP
    SELECT COUNT(*) INTO v_exist
      FROM CONSUMABLE_STOCKS
     WHERE CONSUMABLE_CODE = m.CONSUMABLE_CODE
       AND COMPANY = m.COMPANY AND PLANT_CD = m.PLANT_CD
       AND STATUS <> 'SCRAPPED';

    -- 장착중인 마스터는 최소 1개는 있어야 한다(재고수량이 0이어도)
    v_need := GREATEST(m.STOCK_QTY, CASE WHEN m.OPER_STATUS = 'MOUNTED' THEN 1 ELSE 0 END) - v_exist;
    IF v_need <= 0 THEN CONTINUE; END IF;

    v_first := (v_exist = 0);

    FOR i IN 1 .. v_need LOOP
      v_uid := PKG_SEQ_GENERATOR.GET_NO('CON_UID');

      IF v_first AND i = 1 AND m.OPER_STATUS = 'MOUNTED' THEN
        v_status := 'MOUNTED';  v_equip := m.MOUNTED_EQUIP_ID;
        v_count  := m.CURRENT_COUNT; v_life := m.STATUS;
      ELSIF v_first AND i = 1 AND m.OPER_STATUS = 'REPAIR' THEN
        v_status := 'REPAIR';   v_equip := NULL;
        v_count  := m.CURRENT_COUNT; v_life := m.STATUS;
      ELSIF v_first AND i = 1 THEN
        v_status := 'ACTIVE';   v_equip := NULL;
        v_count  := m.CURRENT_COUNT; v_life := m.STATUS;
      ELSE
        v_status := 'ACTIVE';   v_equip := NULL;
        v_count  := 0;          v_life := 'NORMAL';
      END IF;

      INSERT INTO CONSUMABLE_STOCKS
        (CON_UID, CONSUMABLE_CODE, STATUS, LIFE_STATUS, CURRENT_COUNT,
         LOCATION, PROCESS_CODE, MOUNTED_EQUIP_CODE, RECV_DATE,
         REMARK, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
      VALUES
        (v_uid, m.CONSUMABLE_CODE, v_status, v_life, v_count,
         m.LOCATION, NULL, v_equip, SYSTIMESTAMP,
         '마스터 단위 → 실물 단위 전환 자동 생성(2026-09-14)', m.COMPANY, m.PLANT_CD, 'migration',
         SYSTIMESTAMP, SYSTIMESTAMP);

      v_made := v_made + 1;
    END LOOP;
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('생성된 소모품 인스턴스 : ' || v_made);
END;
/

-- 장착 이관분에 대해 장착 이력을 남긴다(이관 시점 기준 MOUNT 1건)
INSERT INTO CONSUMABLE_MOUNT_LOGS
  (MOUNT_DATE, SEQ, CON_UID, CONSUMABLE_CODE, EQUIP_CODE, ACTION, WORKER_CODE, REMARK, COMPANY, PLANT_CD, CREATED_AT)
SELECT TRUNC(SYSDATE), SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL, s.CON_UID, s.CONSUMABLE_CODE,
       s.MOUNTED_EQUIP_CODE, 'MOUNT', NULL,
       '마스터 장착 상태 이관(2026-09-14)', s.COMPANY, s.PLANT_CD, SYSTIMESTAMP
  FROM CONSUMABLE_STOCKS s
 WHERE s.STATUS = 'MOUNTED'
   AND s.CREATED_BY = 'migration'
   AND NOT EXISTS (SELECT 1 FROM CONSUMABLE_MOUNT_LOGS l WHERE l.CON_UID = s.CON_UID)
/

COMMIT
/

-- =====================================================================
-- 4) 이관 결과 확인 (조회만)
-- =====================================================================
-- 4-1. 마스터 vs 인스턴스 건수 비교
SELECT m.CONSUMABLE_CODE, m.CATEGORY, m.STOCK_QTY, m.OPER_STATUS AS 마스터_운용상태,
       (SELECT COUNT(*) FROM CONSUMABLE_STOCKS s
         WHERE s.CONSUMABLE_CODE = m.CONSUMABLE_CODE AND s.STATUS <> 'SCRAPPED') AS 인스턴스수,
       (SELECT COUNT(*) FROM CONSUMABLE_STOCKS s
         WHERE s.CONSUMABLE_CODE = m.CONSUMABLE_CODE AND s.STATUS = 'MOUNTED') AS 장착중
  FROM CONSUMABLE_MASTERS m
 WHERE NVL(m.USE_YN, 'Y') = 'Y'
 ORDER BY m.CATEGORY, m.CONSUMABLE_CODE
/

-- 4-2. 마스터는 장착중인데 인스턴스가 장착중이 아닌 건 (이관 누락 점검 — 0건이어야 정상)
SELECT m.CONSUMABLE_CODE, m.MOUNTED_EQUIP_ID
  FROM CONSUMABLE_MASTERS m
 WHERE m.OPER_STATUS = 'MOUNTED'
   AND NOT EXISTS (SELECT 1 FROM CONSUMABLE_STOCKS s
                    WHERE s.CONSUMABLE_CODE = m.CONSUMABLE_CODE AND s.STATUS = 'MOUNTED')
/

-- =====================================================================
-- 5) (전환 검증이 끝난 뒤 별도로 실행) 마스터 장착 컬럼 정리
--    애플리케이션은 더 이상 OPER_STATUS / MOUNTED_EQUIP_ID 를 읽지도 쓰지도 않는다.
--    컬럼을 바로 지우지 말고, 운영에서 한동안 지켜본 뒤 아래를 실행할 것.
-- =====================================================================
-- UPDATE CONSUMABLE_MASTERS SET OPER_STATUS = 'WAREHOUSE', MOUNTED_EQUIP_ID = NULL;
-- COMMIT;
-- ALTER TABLE CONSUMABLE_MASTERS DROP COLUMN MOUNTED_EQUIP_ID;
-- ALTER TABLE CONSUMABLE_MASTERS DROP COLUMN OPER_STATUS;
