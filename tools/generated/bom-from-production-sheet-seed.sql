DECLARE
  v_company CONSTANT VARCHAR2(50) := '40';
  v_plant   CONSTANT VARCHAR2(50) := '1000';
  v_user    CONSTANT VARCHAR2(50) := 'codex';

  PROCEDURE ins_item(
    p_code VARCHAR2,
    p_name VARCHAR2,
    p_type VARCHAR2,
    p_unit VARCHAR2,
    p_product_type VARCHAR2,
    p_remark VARCHAR2
  ) IS
  BEGIN
    INSERT INTO ITEM_MASTERS (
      ITEM_CODE, ITEM_NAME, PART_NO, ITEM_TYPE, PRODUCT_TYPE, REV, UNIT,
      IQC_FLAG, LEAD_TIME, SAFETY_STOCK, BOX_QTY, TACT_TIME, EXPIRY_DATE,
      TOLERANCE_RATE, IS_SPLITTABLE, USE_YN, COMPANY, PLANT_CD,
      CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, REMARK
    ) VALUES (
      p_code, p_name, p_code, p_type, p_product_type, 'A', p_unit,
      CASE WHEN p_type = 'RAW_MATERIAL' THEN 'Y' ELSE 'N' END,
      0, 0, 0, 0, 0, 5, 'Y', 'Y', v_company, v_plant,
      v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP, p_remark
    );
  END;

  PROCEDURE ins_process(
    p_code VARCHAR2,
    p_name VARCHAR2,
    p_sort NUMBER,
    p_category VARCHAR2
  ) IS
  BEGIN
    INSERT INTO PROCESS_MASTERS (
      PROCESS_CODE, PROCESS_NAME, PROCESS_TYPE, SORT_ORDER, PROCESS_CATEGORY,
      USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, REMARK
    ) VALUES (
      p_code, p_name, 'PRODUCTION', p_sort, p_category,
      'Y', v_company, v_plant, v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP,
      'bom-from-production-sheet.html 기준 생성'
    );
  END;

  PROCEDURE ins_bom(
    p_parent VARCHAR2,
    p_child VARCHAR2,
    p_qty NUMBER,
    p_seq NUMBER,
    p_oper VARCHAR2,
    p_remark VARCHAR2
  ) IS
  BEGIN
    INSERT INTO BOM_MASTERS (
      PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION, QTY_PER, SEQ, BOM_GRP, OPER,
      VALID_FROM, USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT, REMARK
    ) VALUES (
      p_parent, p_child, 'A', p_qty, p_seq, 'HNS01', p_oper,
      DATE '2026-06-01', 'Y', v_company, v_plant, v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP, p_remark
    );
  END;

  PROCEDURE ins_routing_group(
    p_code VARCHAR2,
    p_name VARCHAR2,
    p_item VARCHAR2
  ) IS
  BEGIN
    INSERT INTO ROUTING_GROUPS (
      ROUTING_CODE, ROUTING_NAME, ITEM_CODE, DESCRIPTION, USE_YN,
      COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      p_code, p_name, p_item, 'bom-from-production-sheet.html 기준 라우팅', 'Y',
      v_company, v_plant, v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;

  PROCEDURE ins_routing_process(
    p_routing VARCHAR2,
    p_seq NUMBER,
    p_process VARCHAR2,
    p_name VARCHAR2,
    p_equip VARCHAR2,
    p_sample VARCHAR2,
    p_destructive VARCHAR2,
    p_method VARCHAR2,
    p_remark VARCHAR2
  ) IS
  BEGIN
    INSERT INTO ROUTING_PROCESSES (
      ROUTING_CODE, SEQ, PROCESS_CODE, PROCESS_NAME, PROCESS_TYPE, EQUIP_TYPE,
      STD_TIME, SETUP_TIME, SAMPLE_INSPECT_YN, QC_SELF_YN, INSPECT_METHOD,
      DESTRUCTIVE_YN, SAMPLE_QTY, USE_YN, COMPANY, PLANT_CD,
      CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      p_routing, p_seq, p_process, p_name, 'PRODUCTION', p_equip,
      NULL, NULL, CASE WHEN p_sample IS NULL THEN 'N' ELSE 'Y' END, 'N',
      CASE WHEN p_method = '의뢰' THEN 'REQUEST' ELSE 'DIRECT' END,
      CASE WHEN p_destructive = 'O' THEN 'Y' ELSE 'N' END, 1, 'Y',
      v_company, v_plant, v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;

  PROCEDURE ins_routing_material(
    p_routing VARCHAR2,
    p_seq NUMBER,
    p_child VARCHAR2,
    p_qty NUMBER
  ) IS
  BEGIN
    INSERT INTO ROUTING_MATERIALS (
      ROUTING_CODE, SEQ, CHILD_ITEM_CODE, ALLOC_QTY, ISSUE_METHOD, USE_YN,
      COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      p_routing, p_seq, p_child, p_qty, 'BACKFLUSH', 'Y',
      v_company, v_plant, v_user, v_user, SYSTIMESTAMP, SYSTIMESTAMP
    );
  END;
BEGIN
  DELETE FROM PROCESS_QUALITY_CONDITIONS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM ROUTING_MATERIALS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM ROUTING_PROCESSES WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM ROUTING_GROUPS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM BOM_MASTERS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM PROD_PLANS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM PROCESS_MASTERS WHERE COMPANY = v_company AND PLANT_CD = v_plant;
  DELETE FROM ITEM_MASTERS WHERE COMPANY = v_company AND PLANT_CD = v_plant;

  ins_item('HNS001', 'HNS01 판매/모델 코드', 'FINISHED', 'EA', 'MODEL', 'HTML 주석: HNS001은 HNS01의 상위 판매/관리 코드이며 BOM 레벨 밖에 둠');
  ins_item('HNS01', '완제품 하네스', 'FINISHED', 'EA', 'HARNESS', 'Lv0 완제품, 제품코드 HNS001 매핑');
  ins_item('HNS01-C1', '회로1', 'SEMI_PRODUCT', 'EA', 'SUB_ASSY', 'Lv1 반제품');
  ins_item('HNS01-C2', '회로2', 'SEMI_PRODUCT', 'EA', 'SUB_ASSY', 'Lv1 반제품');
  ins_item('CBL-A', '케이블A', 'RAW_MATERIAL', 'MM', 'WIRE', 'HTML 구분: 원자재');
  ins_item('TMN-A', '터미널A', 'RAW_MATERIAL', 'EA', 'TERMINAL', 'HTML 구분: 구매품');
  ins_item('PHDL001', '플라스틱홀더', 'RAW_MATERIAL', 'EA', 'HOLDER', 'HTML 구분: 구매품');
  ins_item('RSL-A', '고무씰A', 'RAW_MATERIAL', 'EA', 'SEAL', 'HTML 구분: 구매품');
  ins_item('TMN-B', '터미널B', 'RAW_MATERIAL', 'EA', 'TERMINAL', 'HTML 구분: 구매품');
  ins_item('CBL-B', '케이블B', 'RAW_MATERIAL', 'MM', 'WIRE', 'HTML 구분: 원자재');
  ins_item('RSL-B', '고무씰B', 'RAW_MATERIAL', 'EA', 'SEAL', 'HTML 구분: 구매품');
  ins_item('CSH001', '클램프쉴드', 'RAW_MATERIAL', 'EA', 'SHIELD', 'HTML 구분: 구매품');
  ins_item('TMN-C', '터미널C', 'RAW_MATERIAL', 'EA', 'TERMINAL', 'HTML 구분: 구매품');
  ins_item('TUB-A', '수축튜브A', 'RAW_MATERIAL', 'MM', 'TUBE', 'HTML 구분: 원자재');
  ins_item('CNTR001', '커넥터', 'RAW_MATERIAL', 'EA', 'CONNECTOR', 'HTML 구분: 구매품');
  ins_item('HLD-01', '홀더', 'RAW_MATERIAL', 'EA', 'HOLDER', 'HTML 구분: 구매품');
  ins_item('TP0001', '절연테잎', 'RAW_MATERIAL', 'MM', 'TAPE', '배판작업 500MM + 조립 300MM로 2회 투입');
  ins_item('HSG0001', '하우징', 'RAW_MATERIAL', 'EA', 'HOUSING', 'HTML 구분: 구매품');

  ins_process('ATCUT', '자동절단', 10, 'WIRE');
  ins_process('STRPB', '양단탈피', 20, 'WIRE');
  ins_process('CRMPF', '전단압착', 30, 'TERMINAL');
  ins_process('AUXMT', '부자재장착', 40, 'ASSEMBLY');
  ins_process('WELDR', '후단융착', 50, 'TERMINAL');
  ins_process('TINSP', '단자검사', 60, 'INSPECTION');
  ins_process('ATCNS', '자동절단탈피', 70, 'WIRE');
  ins_process('SHDRM', '편조제거', 80, 'WIRE');
  ins_process('HEXCP', '육각압착', 90, 'TERMINAL');
  ins_process('CRMPR', '후단압착', 100, 'TERMINAL');
  ins_process('TUBHT', '튜브열처리', 110, 'HEAT');
  ins_process('SASSY', '서브조립', 120, 'ASSEMBLY');
  ins_process('TAPPN', '배판작업(테이핑)', 130, 'ASSEMBLY');
  ins_process('MASSY', '조립', 140, 'ASSEMBLY');
  ins_process('AINSP', '통합검사', 150, 'INSPECTION');
  ins_process('OINSP', '외관검사', 160, 'INSPECTION');

  ins_bom('HNS01', 'HNS01-C1', 1, 1, 'SASSY', '서브조립 SASSY 순번1 투입');
  ins_bom('HNS01', 'HNS01-C2', 1, 2, 'SASSY', '서브조립 SASSY 순번1 투입');
  ins_bom('HNS01', 'CNTR001', 1, 3, 'SASSY', '서브조립 SASSY 순번1 투입');
  ins_bom('HNS01', 'HLD-01', 1, 4, 'SASSY', '서브조립 SASSY 순번1 투입');
  ins_bom('HNS01', 'TP0001', 800, 5, 'MULTI', '동일 품목 2회 투입: TAPPN 500MM + MASSY 300MM');
  ins_bom('HNS01', 'HSG0001', 1, 6, 'MASSY', '조립 MASSY 순번3 투입');
  ins_bom('HNS01-C1', 'CBL-A', 500, 1, 'ATCUT', '자동절단 ATCUT 순번1 투입');
  ins_bom('HNS01-C1', 'TMN-A', 1, 2, 'CRMPF', '전단압착 CRMPF 순번3 투입');
  ins_bom('HNS01-C1', 'PHDL001', 1, 3, 'AUXMT', '부자재장착 AUXMT 순번4 투입');
  ins_bom('HNS01-C1', 'RSL-A', 1, 4, 'AUXMT', '부자재장착 AUXMT 순번4 투입');
  ins_bom('HNS01-C1', 'TMN-B', 1, 5, 'WELDR', '후단융착 WELDR 순번5 투입');
  ins_bom('HNS01-C2', 'CBL-B', 650, 1, 'ATCNS', '자동절단탈피 ATCNS 순번1 투입');
  ins_bom('HNS01-C2', 'RSL-B', 2, 2, 'AUXMT', '부자재장착 AUXMT 순번3 투입');
  ins_bom('HNS01-C2', 'CSH001', 1, 3, 'HEXCP', '육각압착 HEXCP 순번4 투입');
  ins_bom('HNS01-C2', 'TMN-C', 1, 4, 'CRMPR', '후단압착 CRMPR 순번5 투입');
  ins_bom('HNS01-C2', 'TUB-A', 20, 5, 'TUBHT', '튜브열처리 TUBHT 순번6 투입');

  ins_routing_group('RT-HNS01-C1', '회로1 라우팅', 'HNS01-C1');
  ins_routing_group('RT-HNS01-C2', '회로2 라우팅', 'HNS01-C2');
  ins_routing_group('RT-HNS01', '완제품 하네스 라우팅', 'HNS01');

  ins_routing_process('RT-HNS01-C1', 1, 'ATCUT', '자동절단', '자동절단기 1호', '재단길이(측정)·마킹상태(판정)', 'X', '직접', '라벨 O');
  ins_routing_process('RT-HNS01-C1', 2, 'STRPB', '양단탈피', '자동탈피기 1호', '탈피길이(측정)', NULL, NULL, NULL);
  ins_routing_process('RT-HNS01-C1', 3, 'CRMPF', '전단압착', '자동압착기 1호', '압착고·인장력(측정)', 'O', '의뢰', NULL);
  ins_routing_process('RT-HNS01-C1', 4, 'AUXMT', '부자재장착', '작업대 1호', NULL, NULL, NULL, NULL);
  ins_routing_process('RT-HNS01-C1', 5, 'WELDR', '후단융착', '융착기 1호', '압착고·인장력(측정)', 'O', '의뢰', NULL);
  ins_routing_process('RT-HNS01-C1', 6, 'TINSP', '단자검사', '단자검사기 1호', NULL, NULL, NULL, NULL);

  ins_routing_process('RT-HNS01-C2', 1, 'ATCNS', '자동절단탈피', '자동절단기 2호', '재단·탈피길이(측정)·마킹(판정)', 'X', '직접', '라벨 O');
  ins_routing_process('RT-HNS01-C2', 2, 'SHDRM', '편조제거', '실드탈피기 1호', '탈피상태(판정)', 'X', '직접', NULL);
  ins_routing_process('RT-HNS01-C2', 3, 'AUXMT', '부자재장착', '작업대 1호', NULL, NULL, NULL, NULL);
  ins_routing_process('RT-HNS01-C2', 4, 'HEXCP', '육각압착', '육각압착기 1호', '압착고·인장력(측정)', 'O', '의뢰', NULL);
  ins_routing_process('RT-HNS01-C2', 5, 'CRMPR', '후단압착', '자동압착기 1호', '압착고·인장력(측정)', 'O', '의뢰', NULL);
  ins_routing_process('RT-HNS01-C2', 6, 'TUBHT', '튜브열처리', '열처리작업대 1호', '수축상태(판정)', 'O', '직접', NULL);
  ins_routing_process('RT-HNS01-C2', 7, 'TINSP', '단자검사', '단자검사기 2호', NULL, NULL, NULL, NULL);

  ins_routing_process('RT-HNS01', 1, 'SASSY', '서브조립', '작업대 2호', NULL, NULL, NULL, '라벨 O');
  ins_routing_process('RT-HNS01', 2, 'TAPPN', '배판작업(테이핑)', '배판1라인', NULL, NULL, NULL, NULL);
  ins_routing_process('RT-HNS01', 3, 'MASSY', '조립', '작업대 3호', NULL, NULL, NULL, NULL);
  ins_routing_process('RT-HNS01', 4, 'AINSP', '통합검사', '통합검사기 1호', NULL, NULL, NULL, '합격시회로라벨');
  ins_routing_process('RT-HNS01', 5, 'OINSP', '외관검사', '외관검사대 1호', NULL, NULL, NULL, NULL);

  ins_routing_material('RT-HNS01-C1', 1, 'CBL-A', 500);
  ins_routing_material('RT-HNS01-C1', 3, 'TMN-A', 1);
  ins_routing_material('RT-HNS01-C1', 4, 'PHDL001', 1);
  ins_routing_material('RT-HNS01-C1', 4, 'RSL-A', 1);
  ins_routing_material('RT-HNS01-C1', 5, 'TMN-B', 1);
  ins_routing_material('RT-HNS01-C2', 1, 'CBL-B', 650);
  ins_routing_material('RT-HNS01-C2', 3, 'RSL-B', 2);
  ins_routing_material('RT-HNS01-C2', 4, 'CSH001', 1);
  ins_routing_material('RT-HNS01-C2', 5, 'TMN-C', 1);
  ins_routing_material('RT-HNS01-C2', 6, 'TUB-A', 20);
  ins_routing_material('RT-HNS01', 1, 'HNS01-C1', 1);
  ins_routing_material('RT-HNS01', 1, 'HNS01-C2', 1);
  ins_routing_material('RT-HNS01', 1, 'CNTR001', 1);
  ins_routing_material('RT-HNS01', 1, 'HLD-01', 1);
  ins_routing_material('RT-HNS01', 2, 'TP0001', 500);
  ins_routing_material('RT-HNS01', 3, 'HSG0001', 1);
  ins_routing_material('RT-HNS01', 3, 'TP0001', 300);

  COMMIT;
END;
/
