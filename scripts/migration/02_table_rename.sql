-- ============================================================================
-- Phase 2: 테이블 리네임 (PART_MASTERS → ITEM_MASTERS)
-- ============================================================================
-- 멱등성: 이미 변경된 경우 무시
-- ============================================================================

SET SERVEROUTPUT ON;

DECLARE
  v_cnt NUMBER;
BEGIN
  -- PART_MASTERS가 존재하고 ITEM_MASTERS가 없는 경우만 실행
  SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'PART_MASTERS';
  IF v_cnt > 0 THEN
    SELECT COUNT(*) INTO v_cnt FROM user_tables WHERE table_name = 'ITEM_MASTERS';
    IF v_cnt = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE PART_MASTERS RENAME TO ITEM_MASTERS';
      DBMS_OUTPUT.PUT_LINE('OK: PART_MASTERS → ITEM_MASTERS');
    ELSE
      DBMS_OUTPUT.PUT_LINE('SKIP: ITEM_MASTERS already exists');
    END IF;
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: PART_MASTERS not found (already renamed?)');
  END IF;
END;
/

PROMPT '=== Phase 2 Complete: Table rename done ===';
