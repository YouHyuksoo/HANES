DECLARE
  v_main_drawing_id NUMBER;
  v_main_rev_a_id NUMBER;
  v_main_rev_b_id NUMBER;
  v_sub_drawing_id NUMBER;
  v_sub_rev_a_id NUMBER;

  PROCEDURE add_circuit(
    p_revision_id IN NUMBER,
    p_sort_order IN NUMBER,
    p_circuit_no IN VARCHAR2,
    p_wire_spec IN VARCHAR2,
    p_wire_size IN VARCHAR2,
    p_color_code IN VARCHAR2,
    p_color_name IN VARCHAR2,
    p_length_mm IN NUMBER,
    p_strip_a_mm IN NUMBER,
    p_strip_b_mm IN NUMBER,
    p_end_a_housing IN VARCHAR2,
    p_end_a_terminal IN VARCHAR2,
    p_connection_symbol IN VARCHAR2,
    p_end_b_terminal IN VARCHAR2,
    p_end_b_housing IN VARCHAR2,
    p_tube_spec IN VARCHAR2,
    p_sub_no IN VARCHAR2,
    p_remark IN VARCHAR2
  ) IS
  BEGIN
    INSERT INTO HARNESS_CIRCUIT_SPECS (
      CIRCUIT_ID, REVISION_ID, SORT_ORDER, CIRCUIT_NO,
      WIRE_SPEC, WIRE_SIZE, COLOR_CODE, COLOR_NAME, LENGTH_MM,
      STRIP_A_MM, STRIP_B_MM, END_A_HOUSING, END_A_TERMINAL,
      CONNECTION_SYMBOL, END_B_TERMINAL, END_B_HOUSING,
      TUBE_SPEC, SUB_NO, REMARK,
      COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
    ) VALUES (
      SEQ_HARNESS_CIRCUIT_ID.NEXTVAL, p_revision_id, p_sort_order, p_circuit_no,
      p_wire_spec, p_wire_size, p_color_code, p_color_name, p_length_mm,
      p_strip_a_mm, p_strip_b_mm, p_end_a_housing, p_end_a_terminal,
      p_connection_symbol, p_end_b_terminal, p_end_b_housing,
      p_tube_spec, p_sub_no, p_remark,
      '40', '1000', 'seed', 'seed'
    );
  END;
BEGIN
  DELETE FROM HARNESS_CIRCUIT_SPECS
   WHERE REVISION_ID IN (
     SELECT r.REVISION_ID
       FROM HARNESS_DRAWING_REVISIONS r
       JOIN HARNESS_DRAWING_MASTERS m ON m.DRAWING_ID = r.DRAWING_ID
      WHERE m.COMPANY = '40'
        AND m.PLANT_CD = '1000'
        AND m.DRAWING_NO IN ('HDW-SEED-HNS02-MAIN', 'HDW-SEED-HNS02-C1ABCD')
   );

  DELETE FROM HARNESS_DRAWING_REVISIONS
   WHERE DRAWING_ID IN (
     SELECT DRAWING_ID
       FROM HARNESS_DRAWING_MASTERS
      WHERE COMPANY = '40'
        AND PLANT_CD = '1000'
        AND DRAWING_NO IN ('HDW-SEED-HNS02-MAIN', 'HDW-SEED-HNS02-C1ABCD')
   );

  DELETE FROM HARNESS_DRAWING_MASTERS
   WHERE COMPANY = '40'
     AND PLANT_CD = '1000'
     AND DRAWING_NO IN ('HDW-SEED-HNS02-MAIN', 'HDW-SEED-HNS02-C1ABCD');

  v_main_drawing_id := SEQ_HARNESS_DRAWING_ID.NEXTVAL;
  INSERT INTO HARNESS_DRAWING_MASTERS (
    DRAWING_ID, DRAWING_NO, ITEM_CODE, ITEM_NAME, ERP_ITEM_NO, CUSTOMER_PART_NO,
    REMARK, USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
  ) VALUES (
    v_main_drawing_id, 'HDW-SEED-HNS02-MAIN', 'HNS02', '완제품 하네스',
    'EA060946255-S-M001', 'LDWX00182NA',
    '제품 도면관리 화면 검증용 하네스 메인 도면 seed', 'Y', '40', '1000', 'seed', 'seed'
  );

  v_main_rev_a_id := SEQ_HARNESS_DRAWING_REV_ID.NEXTVAL;
  INSERT INTO HARNESS_DRAWING_REVISIONS (
    REVISION_ID, DRAWING_ID, REVISION_CODE, STATUS, EFFECTIVE_FROM, CHANGE_REASON,
    APPROVED_BY, APPROVED_AT, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
  ) VALUES (
    v_main_rev_a_id, v_main_drawing_id, 'A', 'APPROVED', DATE '2026-06-18',
    '초도 도면 승인', 'seed', SYSTIMESTAMP, '40', '1000', 'seed', 'seed'
  );

  add_circuit(v_main_rev_a_id, 10, '1', 'VSF 0.75SQ', '20', 'BL', 'Xanh Biển', 828, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', '메인 전원 라인');
  add_circuit(v_main_rev_a_id, 20, '2', 'VSF 0.75SQ', '20', 'RD', 'Đỏ', 830, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', '메인 전원 라인');
  add_circuit(v_main_rev_a_id, 30, '3', 'VSF 0.75SQ', '20', 'YL', 'Vàng', 835, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', '신호 라인');
  add_circuit(v_main_rev_a_id, 40, '8', '1007', '26', 'BK', 'Đen', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');
  add_circuit(v_main_rev_a_id, 50, '9', '1007', '26', 'BN', 'Nâu', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');
  add_circuit(v_main_rev_a_id, 60, '10', '1007', '26', 'RD', 'Đỏ', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');

  v_main_rev_b_id := SEQ_HARNESS_DRAWING_REV_ID.NEXTVAL;
  INSERT INTO HARNESS_DRAWING_REVISIONS (
    REVISION_ID, DRAWING_ID, REVISION_CODE, STATUS, EFFECTIVE_FROM, CHANGE_REASON,
    APPROVED_BY, APPROVED_AT, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
  ) VALUES (
    v_main_rev_b_id, v_main_drawing_id, 'B', 'DRAFT', NULL,
    '회로 1/2 길이 보정 검토', NULL, NULL, '40', '1000', 'seed', 'seed'
  );

  add_circuit(v_main_rev_b_id, 10, '1', 'VSF 0.75SQ', '20', 'BL', 'Xanh Biển', 832, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', 'Rev.B 길이 +4mm 검토');
  add_circuit(v_main_rev_b_id, 20, '2', 'VSF 0.75SQ', '20', 'RD', 'Đỏ', 834, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', 'Rev.B 길이 +4mm 검토');
  add_circuit(v_main_rev_b_id, 30, '3', 'VSF 0.75SQ', '20', 'YL', 'Vàng', 835, 5.0, 5.0, '620877-2', '740637-3', 'STRAIGHT', '35068-9802', '68416-0304', NULL, 'Sub 1', '신호 라인');
  add_circuit(v_main_rev_b_id, 40, '8', '1007', '26', 'BK', 'Đen', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');
  add_circuit(v_main_rev_b_id, 50, '9', '1007', '26', 'BN', 'Nâu', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');
  add_circuit(v_main_rev_b_id, 60, '10', '1007', '26', 'RD', 'Đỏ', 180, 2.0, 3.3, 'SMH200-09H', 'YST200-CRT', 'STRAIGHT', 'SSF-01T-P1.4AB', 'PWBR-10V-WGL1(WH)', NULL, 'Sub 4', '테스트 분기 라인');
  add_circuit(v_main_rev_b_id, 70, '33', '1007#24', '24', 'BK', 'Đen', 785, 3.3, 5.3, 'PWBP-06V-WGL1-R', 'SSF-01T-P1.4AB', 'BRIDGE', '731261-3', 'SL-58(BL)', NULL, 'Sub 6', '압착 조건 검토 회로');
  add_circuit(v_main_rev_b_id, 80, '34', '1007#24', '24', 'BK', 'Đen', 155, 5.3, 5.3, 'SL-58(NA)', '731261-3', 'BRIDGE', '731261-3S', 'SL-58(BL)', NULL, 'Sub 6', '압착 조건 검토 회로');

  v_sub_drawing_id := SEQ_HARNESS_DRAWING_ID.NEXTVAL;
  INSERT INTO HARNESS_DRAWING_MASTERS (
    DRAWING_ID, DRAWING_NO, ITEM_CODE, ITEM_NAME, ERP_ITEM_NO, CUSTOMER_PART_NO,
    REMARK, USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
  ) VALUES (
    v_sub_drawing_id, 'HDW-SEED-HNS02-C1ABCD', 'HNS02C1ABCD', 'HNS02C1ABCD',
    'EA060946255-J01-M021-2', 'LDWX00200NA',
    '제품 도면관리 화면 검증용 서브 하네스 도면 seed', 'Y', '40', '1000', 'seed', 'seed'
  );

  v_sub_rev_a_id := SEQ_HARNESS_DRAWING_REV_ID.NEXTVAL;
  INSERT INTO HARNESS_DRAWING_REVISIONS (
    REVISION_ID, DRAWING_ID, REVISION_CODE, STATUS, EFFECTIVE_FROM, CHANGE_REASON,
    APPROVED_BY, APPROVED_AT, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
  ) VALUES (
    v_sub_rev_a_id, v_sub_drawing_id, 'A', 'DRAFT', NULL,
    '서브 하네스 초도 작성', NULL, NULL, '40', '1000', 'seed', 'seed'
  );

  add_circuit(v_sub_rev_a_id, 10, '21-1', '1015#18', '18', 'WH', 'Trắng', 980, 10.0, 5.3, NULL, NULL, 'ONE_SIDE', '731261-3', 'SL-18TF WH', NULL, 'Sub 5', '작업지시 J01-M021-1 참조');
  add_circuit(v_sub_rev_a_id, 20, '21-2', '1015#18', '18', 'WH', 'Trắng', 550, 10.0, 4.0, NULL, NULL, 'ONE_SIDE', '65001TS', '70001HS-04A', NULL, 'Sub 5', '작업지시 J01-M021-2 참조');
  add_circuit(v_sub_rev_a_id, 30, '37', '1015#22', '22', 'BK', 'Đen', 1795, 4.2, 4.0, 'YH500-06C BL', 'YT500-CS', 'STRAIGHT', 'YTT500', 'SL-46(WH)', NULL, 'Sub 1', '장거리 신호 라인');

  COMMIT;
END;
/
