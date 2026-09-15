-- THN 관리계획서 PDF 기반 표준 Control Plan 시드
-- 대상: JSHANES COMPANY='40', PLANT_CD='1000', ITEM_CODE='N91H00-X9800-R-S'
-- 근거: C:/Users/hsyou/Desktop/THN 관리계획서.pdf 및 docs/guides/thn-control-plan.md
-- 멱등성: PROJECT_CODE='THN-STD-2026' 패키지가 이미 있으면 재삽입하지 않는다.

DECLARE
  l_package_id NUMBER;
  l_pfd_doc NUMBER;
  l_pfmea_doc NUMBER;
  l_cp_doc NUMBER;
  l_pfd_rev NUMBER;
  l_pfmea_rev NUMBER;
  l_cp_rev NUMBER;
  l_item_name VARCHAR2(200);
  l_pfd_row NUMBER;
  l_pfmea_row NUMBER;
  l_cp_row NUMBER;
  l_seq NUMBER := 0;

  PROCEDURE add_item(
    p_process_no VARCHAR2, p_characteristic_no VARCHAR2, p_product VARCHAR2,
    p_process VARCHAR2, p_special VARCHAR2, p_spec VARCHAR2, p_eval VARCHAR2,
    p_sample VARCHAR2, p_freq VARCHAR2, p_control VARCHAR2, p_role VARCHAR2,
    p_reaction VARCHAR2, p_record VARCHAR2
  ) IS
    l_process_name VARCHAR2(200);
  BEGIN
    l_seq := l_seq + 1;
    SELECT ROW_ID, PROCESS_NAME INTO l_pfd_row, l_process_name
      FROM QUALITY_PROCESS_FLOW_ROWS
     WHERE REVISION_ID = l_pfd_rev AND COMPANY = '40' AND PLANT_CD = '1000'
       AND PROCESS_NO = p_process_no;

    l_pfmea_row := SEQ_QUALITY_PFMEA_ROW.NEXTVAL;
    INSERT INTO QUALITY_PFMEA_ROWS
      (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID,
       PROCESS_FUNCTION, REQUIREMENT, FAILURE_MODE, FAILURE_EFFECT, SEVERITY,
       SPECIAL_CHAR_CODE, FAILURE_CAUSE, PREVENTION_CONTROL, OCCURRENCE,
       DETECTION_CONTROL, DETECTION, RPN, RECOMMENDED_ACTION, RESPONSIBLE_ORG,
       RESPONSIBLE_PERSON, CREATED_BY, UPDATED_BY)
    VALUES
      (l_pfmea_row, l_pfmea_rev, l_seq, '40', '1000', l_pfd_row,
       p_process, p_spec, '규격 이탈 또는 누락', '고객 불만·공정 불량',
       CASE WHEN p_special = 'CC' THEN 8 WHEN p_special = 'HI' THEN 7 ELSE 5 END,
       p_special, '작업조건·자재 식별 오류', '작업표준 및 바코드 대조', 2,
       p_control, 3,
       CASE WHEN p_special = 'CC' THEN 48 WHEN p_special = 'HI' THEN 42 ELSE 30 END,
       '이상 원인 제거 및 재발 방지', p_role, '품질담당', 'thn-standard-seed', 'thn-standard-seed');

    l_cp_row := SEQ_QUALITY_CONTROL_PLAN_ROW.NEXTVAL;
    INSERT INTO QUALITY_CONTROL_PLAN_ROWS
      (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_FLOW_ROW_ID,
       PFMEA_ROW_ID, PROCESS_NO, PROCESS_NAME, CHARACTERISTIC_NO,
       PRODUCT_CHARACTERISTIC, PROCESS_CHARACTERISTIC, SPECIAL_CHAR_CODE,
       SPECIFICATION, EVALUATION_METHOD, SAMPLE_SIZE, SAMPLE_FREQUENCY,
       CONTROL_METHOD, RESPONSIBLE_ROLE, REACTION_PLAN, RECORD_FORM,
       CREATED_BY, UPDATED_BY)
    VALUES
      (l_cp_row, l_cp_rev, l_seq, '40', '1000', l_pfd_row, l_pfmea_row,
       p_process_no, l_process_name, p_characteristic_no, p_product, p_process,
       p_special, p_spec, p_eval, p_sample, p_freq, p_control, p_role,
       p_reaction, p_record, 'thn-standard-seed', 'thn-standard-seed');
  END add_item;
BEGIN
  BEGIN
    SELECT PACKAGE_ID INTO l_package_id
      FROM QUALITY_PLAN_PACKAGES
     WHERE COMPANY = '40' AND PLANT_CD = '1000' AND PROJECT_CODE = 'THN-STD-2026';
  EXCEPTION WHEN NO_DATA_FOUND THEN l_package_id := NULL;
  END;

  IF l_package_id IS NULL THEN
    BEGIN
      SELECT ITEM_NAME INTO l_item_name FROM ITEM_MASTERS
       WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_CODE = 'N91H00-X9800-R-S'
         AND ROWNUM = 1;
    EXCEPTION WHEN NO_DATA_FOUND THEN l_item_name := 'N91H00-X9800-R-S THN 표준 반제품';
    END;

    l_package_id := SEQ_QUALITY_PLAN_PACKAGE.NEXTVAL;
    INSERT INTO QUALITY_PLAN_PACKAGES
      (PACKAGE_ID, COMPANY, PLANT_CD, PROJECT_CODE, PROJECT_NAME,
       CUSTOMER_CODE, CUSTOMER_NAME, ITEM_CODE, ITEM_NAME, PART_NUMBER,
       PHASE, ORGANIZATION, KEY_CONTACT, CREATED_BY, UPDATED_BY)
    VALUES
      (l_package_id, '40', '1000', 'THN-STD-2026', 'THN 하네스 양산 표준 관리계획',
       'THN', 'THN', 'N91H00-X9800-R-S', l_item_name, 'N91H00-X9800-R-S',
       'PRODUCTION', '품질보증팀', '하네스 품질담당', 'thn-standard-seed', 'thn-standard-seed');

    l_pfd_doc := SEQ_QUALITY_PLAN_DOCUMENT.NEXTVAL;
    l_pfmea_doc := SEQ_QUALITY_PLAN_DOCUMENT.NEXTVAL;
    l_cp_doc := SEQ_QUALITY_PLAN_DOCUMENT.NEXTVAL;
    INSERT INTO QUALITY_PLAN_DOCUMENTS
      (DOCUMENT_ID, PACKAGE_ID, COMPANY, PLANT_CD, DOCUMENT_TYPE, DOCUMENT_NO,
       TITLE, TEMPLATE_FORM_NO, TEMPLATE_REVISION, CREATED_BY)
    VALUES (l_pfd_doc, l_package_id, '40', '1000', 'PFD',
      'THN-PFD-' || LPAD(l_pfd_doc, 6, '0'), 'THN 공정흐름도', 'QREKA-PR-025-01', '00', 'thn-standard-seed');
    INSERT INTO QUALITY_PLAN_DOCUMENTS
      (DOCUMENT_ID, PACKAGE_ID, COMPANY, PLANT_CD, DOCUMENT_TYPE, DOCUMENT_NO,
       TITLE, TEMPLATE_FORM_NO, TEMPLATE_REVISION, CREATED_BY)
    VALUES (l_pfmea_doc, l_package_id, '40', '1000', 'PFMEA',
      'THN-PFMEA-' || LPAD(l_pfmea_doc, 6, '0'), 'THN 공정 FMEA', 'QREKA-PR-025-02', '00', 'thn-standard-seed');
    INSERT INTO QUALITY_PLAN_DOCUMENTS
      (DOCUMENT_ID, PACKAGE_ID, COMPANY, PLANT_CD, DOCUMENT_TYPE, DOCUMENT_NO,
       TITLE, TEMPLATE_FORM_NO, TEMPLATE_REVISION, CREATED_BY)
    VALUES (l_cp_doc, l_package_id, '40', '1000', 'CONTROL_PLAN',
      'THN-CP-' || LPAD(l_cp_doc, 6, '0'), 'THN 하네스 Control Plan', 'QREKA-PR-025-04', '00', 'thn-standard-seed');

    l_pfd_rev := SEQ_QUALITY_PLAN_REVISION.NEXTVAL;
    l_pfmea_rev := SEQ_QUALITY_PLAN_REVISION.NEXTVAL;
    l_cp_rev := SEQ_QUALITY_PLAN_REVISION.NEXTVAL;
    INSERT INTO QUALITY_PLAN_REVISIONS
      (REVISION_ID, DOCUMENT_ID, COMPANY, PLANT_CD, REVISION_CODE, STATUS,
       ISSUE_DATE, REVISION_DATE, CHANGE_REASON, CHANGE_DESCRIPTION, AUTHOR_ID)
    VALUES (l_pfd_rev, l_pfd_doc, '40', '1000', '00', 'DRAFT', TRUNC(SYSDATE),
      TRUNC(SYSDATE), 'THN 표준 시드', 'THN 관리계획서 PDF 공정 흐름 이관', 'thn-standard-seed');
    INSERT INTO QUALITY_PLAN_REVISIONS
      (REVISION_ID, DOCUMENT_ID, COMPANY, PLANT_CD, REVISION_CODE, STATUS,
       ISSUE_DATE, REVISION_DATE, CHANGE_REASON, CHANGE_DESCRIPTION, AUTHOR_ID, REF_PFD_REVISION_ID)
    VALUES (l_pfmea_rev, l_pfmea_doc, '40', '1000', '00', 'DRAFT', TRUNC(SYSDATE),
      TRUNC(SYSDATE), 'THN 표준 시드', 'THN 관리계획서 PDF PFMEA 항목 이관', 'thn-standard-seed', l_pfd_rev);
    INSERT INTO QUALITY_PLAN_REVISIONS
      (REVISION_ID, DOCUMENT_ID, COMPANY, PLANT_CD, REVISION_CODE, STATUS,
       ISSUE_DATE, REVISION_DATE, CHANGE_REASON, CHANGE_DESCRIPTION, AUTHOR_ID,
       REF_PFD_REVISION_ID, REF_PFMEA_REVISION_ID)
    VALUES (l_cp_rev, l_cp_doc, '40', '1000', '00', 'DRAFT', TRUNC(SYSDATE),
      TRUNC(SYSDATE), 'THN 표준 시드', 'THN 관리계획서 PDF Control Plan 항목 이관', 'thn-standard-seed',
      l_pfd_rev, l_pfmea_rev);

    -- PDF 공정기호 A50~P50. 문서의 공정명과 HANES PFD 행을 동일 계보로 관리한다.
    INSERT INTO QUALITY_PROCESS_FLOW_ROWS
      (ROW_ID, REVISION_ID, ROW_SEQ, COMPANY, PLANT_CD, PROCESS_NO, PROCESS_CODE,
       PROCESS_NAME, EQUIPMENT_NAME, FLOW_LANE, FLOW_SYMBOL, DESCRIPTION, CREATED_BY, UPDATED_BY)
    SELECT SEQ_QUALITY_PROCESS_FLOW_ROW.NEXTVAL, l_pfd_rev, s.seq, '40', '1000', s.no, s.code,
           s.name, s.equip, 'MAIN', CASE WHEN s.inspection = 'Y' THEN 'INSPECTION' ELSE 'OPERATION' END,
           s.description, 'thn-standard-seed', 'thn-standard-seed'
      FROM (
        SELECT 1 seq, 'A50' no, 'THN-A50' code, '자재입고·입고검사' name, 'PDA/육안' equip, 'Y' inspection, '거래명세서·품번·품명·수량 대조' description FROM dual UNION ALL
        SELECT 2, 'A51', 'THN-A51', '자재보관', 'ERP/보관함', 'N', 'FIFO·열화·변형 방지' FROM dual UNION ALL
        SELECT 3, 'A52', 'THN-A52', '자재불출(공정부입)', '피더', 'Y', '수량·혼입·라벨 대조' FROM dual UNION ALL
        SELECT 4, 'B50', 'THN-B50', '전선 일반절단', '자동절단탈피기', 'N', '길이·탈피·마킹·차폐선 관리' FROM dual UNION ALL
        SELECT 5, 'B51', 'THN-B51', '전조선 절단', '자동전선절단기', 'N', '절단공차·스트립·보호캡 관리' FROM dual UNION ALL
        SELECT 6, 'C50', 'THN-C50', '압착준비', '작업대/바코드', 'N', '부자재 혼입·삽입방향 관리' FROM dual UNION ALL
        SELECT 7, 'C51', 'THN-C51', '측각압착(10T PRESS)', '10T PRESS', 'N', '유압·인장력·크림프하이트' FROM dual UNION ALL
        SELECT 8, 'C52', 'THN-C52', '일반압착(2T/6T/30T)', '압착기', 'N', '압착높이·폭·인장력' FROM dual UNION ALL
        SELECT 9, 'C53', 'THN-C53', '결수축 접착·TUBE 가열', 'TUBE 가열기', 'N', '500±20℃·냉각·수지 공극' FROM dual UNION ALL
        SELECT 10, 'D50', 'THN-D50', '반제품 검사', '확대경/내전압기', 'Y', '압착·내전압·GO/NO GAGE' FROM dual UNION ALL
        SELECT 11, 'E50', 'THN-E50', '초원자재 준비', 'TUBE 절단기', 'N', 'TUBE 절단·마킹' FROM dual UNION ALL
        SELECT 12, 'F50', 'THN-F50', '커넥터 체결·초음파 압입', '초음파 압입기', 'N', '체결 깊이·손상·이물' FROM dual UNION ALL
        SELECT 13, 'H50', 'THN-H50', '외장재 조립·JIG', '조립 JIG', 'N', 'JIG 유격·부품 누락' FROM dual UNION ALL
        SELECT 14, 'H51', 'THN-H51', 'C/TUBE 작업', 'C/TUBE 설비', 'N', '위치·수축·변형' FROM dual UNION ALL
        SELECT 15, 'H52', 'THN-H52', '자동 조립 테이핑', '테이핑기', 'N', '테이프 폭·Overlap' FROM dual UNION ALL
        SELECT 16, 'H53', 'THN-H53', '폴테이핑·분기 타이밍', '작업대', 'N', '분기 위치·테이프 밀착' FROM dual UNION ALL
        SELECT 17, 'H54', 'THN-H54', 'B/CABLE·CLIP 조립', '작업대', 'N', 'CLIP·STAY 누락·손상' FROM dual UNION ALL
        SELECT 18, 'H56', 'THN-H56', '프로텍터 체결', '조립 JIG', 'N', '방향·완전 체결' FROM dual UNION ALL
        SELECT 19, 'H57', 'THN-H57', '외장재 체결 토크', '토크 시스템', 'Y', '차종별 토크 기준' FROM dual UNION ALL
        SELECT 20, 'I50', 'THN-I50', '통합회로·기밀시험', '하네스테스터', 'Y', '회로·기밀·내전압' FROM dual UNION ALL
        SELECT 21, 'L50', 'THN-L50', '최종검사', '최종검사대', 'Y', 'ALC/BAR·누락·구조·DIM' FROM dual UNION ALL
        SELECT 22, 'M50', 'THN-M50', '포장작업', '포장대', 'Y', '수량·라벨·BOX' FROM dual UNION ALL
        SELECT 23, 'P50', 'THN-P50', '출하', '출하장', 'Y', '납품차·납품BOX·덮개' FROM dual
      ) s;

    -- PDF의 핵심 관리항목을 공정별로 세분화한 표준 Control Plan.
    add_item('A50','A50-01','자재','품번·품명·수량 대조',NULL,'거래명세서와 품번·품명·수량 일치','PDA 스캔','전수','입고시','ERP 등록·합격증 날인','자재/품질','불합격보고서 통보·반송','IQC 기록');
    add_item('A50','A50-02','WIRE','WIRE 외관·색상·인쇄·도체·권선',NULL,'규격서 색상 일치, 흠·찍힘·인쇄·소선 단선 없음','육안','AQL','입고시','자재검사 체크시트','품질','격리·반송·재검사','IQC 기록');
    add_item('A50','A50-03','HOUSING','HINGE·LANCE·성형', 'HI','수축·변형·과다 BURR·이물·성형불량 없음','육안','AQL','입고시','품목별 IQC 기준 대조','품질','부적합 FLOW·반송','IQC 기록');
    add_item('A50','A50-04','T/W L 단자','단자 이동·외관·권선·캐리어', 'CC','바렐 사이즈 일치, 흠·녹·크랙·변형·역감김 없음','육안','1ROLL','입고시','부품서·라벨 대조','품질','LOT 격리·반송','IQC 기록');
    add_item('A50','A50-05','SEAL·슬리브','표면·이물·색상',NULL,'기포·BURR·흠·찢어짐·변색 없고 규격 색상 일치','육안','AQL','입고시','IQC 체크시트','품질','부적합보고서·반송','IQC 기록');
    add_item('A50','A50-06','W/CABLE·TAPE·C/TUBE','표면·변형·권선·접착',NULL,'기포·WELD LINE·변색·수축·변형·권선불량 없음','육안','AQL','입고시','자재 보관기준 대조','품질','격리·재조달','IQC 기록');
    add_item('A51','A51-01','전품목','FIFO·보관상태', 'HI','열화·변형 방지, 품목별 보관장소·입고일자 식별표 유지','육안/ERP','전수','월1회 또는 입고시','입고일자순 출고·재고표 확인','자재','360일 무실적 재검사 의뢰','재고점검표');
    add_item('A52','A52-01','전품목','공정부입·피더 자주검사',NULL,'찢어짐·혼입·라벨 훼손 없고 ERP 수량과 일치','육안/ERP','전수','불출시','피더 체크시트·바코드 대조','생산','부적합보고·재조달','불출/키팅 기록');
    add_item('B50','B50-01','WIRE','설비 AIR·탈날·마킹기·안전점검',NULL,'AIR 0.5±0.7MPa, 공급기 0.4~0.5MPa, 잉크 0% 아님','점검표/압력계','전수','작업전','바코드 READER 일상점검','생산/보전','설비 정지·보전 호출','설비일상점검표');
    add_item('B50','B50-02','WIRE','절단 길이·재질·굵기','CC','이동전표 일치, 길이 공차 ~1000:+3/0, 1001~2000:+5/0, 2001~3000:+7/0, 3001+:+10/0','줄자/전산','초물 1EA','조건변경시','전산 지시서 측정치 기록','생산/품질','격리·재작업','전산 지시서');
    add_item('B50','B50-03','WIRE','탈피·피복·차폐선·마킹·보호캡', 'HI','내피 ±0.5mm, 외피 ±1mm, 차폐선 단선 2가닥 이내, 마킹 일치','스톱자/육안','전수','LOT별','TJD-B50-002 기준 확인','생산','부적합 FLOW·재작업','자주검사표준');
    add_item('B51','B51-01','WIRE','절단기 AIR·버튼·센서·치구수명',NULL,'AIR 0.4~0.6MPa, 센서 초록→빨강, 키핑블록 200만타','점검표/압력계','전수','작업전/1일1회','바코드 READER 기록','생산/보전','설비 정지·치구 교체','설비일상점검표');
    add_item('B51','B51-02','WIRE','절단길이·탈피·스트립·GO/NO GAGE','CC','절단길이 ±1mm, 내피 ±0.5mm, 외피 ±1mm, 400D GO/NO GAGE','줄자/GAGE/육안','초·중·종물 1EA','LOT별','전산 지시서·TJD-B50-002 기록','생산/품질','격리·재작업','자주검사표준');
    add_item('C50','C50-01','부자재','혼입·파손·삽입방향·쉘·슬리브', 'HI','품목별 보관함, 전산 작업표준 순서·방향·완전 삽입','바코드/육안','전수','작업시','TJD-C50-004 자주검사','생산','안돈·부적합 FLOW','자주검사표준');
    add_item('C51','C51-01','압착','10T PRESS 유압·센서·치구수명',NULL,'유압 80~100kgf/㎠, 오일 30~70mm, 모터 50℃ 이하','압력계/점검표','전수','작업전/1일1회','바코드 READER 설비점검','생산/보전','설비 정지·보전 호출','설비일상점검표');
    add_item('C51','C51-02','압착','인장력·측각압착 크림프하이트','CC','인장력 관리하한 15.8kgf, 크림프하이트 ±0.05mm(30T ±0.10mm)','인장시험기/마이크로미터','초·중·종물 1EA','조건변경시/LOT 300EA','전산 지시서·SPC Cpk 기록','품질','LOT 격리·조건 재설정','SPC/자주검사표준');
    add_item('C52','C52-01','압착','일반압착(2T/6T/30T) 높이·폭·벨마우스','CC','압착 높이·폭은 전산 작업표준, 벨마우스·버·변형 없음','마이크로미터/육안','초·중·종물 1EA','조건변경시/LOT 300EA','Applicator DISK·치구 대조','품질','부적합 격리·재작업','SPC/자주검사표준');
    add_item('C53','C53-01','TUBE','결수축 접착·가열·냉각', 'CC','가열 500±20℃, 실작업 온도·속도 기준 준수, 수지 공극 없음','온도계/육안','초·중·종물 1EA','조건변경시','가열기 조건·냉각 확인','생산/품질','설비 정지·재가열·재작업','가열공정점검표');
    add_item('D50','D50-01','반제품','압착 외관·도체·GO/NO GAGE', 'HI','압착부 손상·누락 없음, 도체압착 높이 ±0.05mm, GAGE 정상','확대경/GAGE','전수','검사시','CHECK SHEET 전산 기록','품질','격리·재작업','반제품 CHECK SHEET');
    add_item('D50','D50-02','반제품','내전압', 'CC','DC 3.0kV / 2mA 이내, 시험 합격','내전압 검사기','전수','검사시','검사기 결과 자동 기록','품질','불합격 격리·원인분석','내전압 검사기록');
    add_item('E50','E50-01','TUBE·원자재','TUBE 절단·마킹',NULL,'작업표준 길이·표시와 일치, 절단면·표면 손상 없음','줄자/육안','초·중·종물 1EA','조건변경시','TUBE 절단 자주검사','생산','재절단·재작업','자주검사표준');
    add_item('F50','F50-01','커넥터','초음파 압입·체결','CC','체결 깊이·방향·고정상태 양호, 손상·이물 없음','육안/깊이게이지','초·중·종물 1EA','조건변경시','압입기 조건·작업표준 대조','생산/품질','설비 정지·재체결','초음파 압입 기록');
    add_item('H50','H50-01','하네스','JIG 유격·변형·부품 누락','HI','JIG POLE 유격·변형 없고 부품 누락·혼입 없음','육안/JIG 점검','전수','작업전/조립시','조립 JIG 체크시트','생산','JIG 교체·부적합 FLOW','조립 자주검사');
    add_item('H51','H51-01','C/TUBE','위치·수축·변형',NULL,'지정 위치에 완전 삽입, 수축·변형·표면불량 없음','육안/줄자','전수','조립시','작업표준 대조','생산','재조립·재작업','조립 자주검사');
    add_item('H52','H52-01','TAPE','테이프 폭·Overlap', 'HI','테이프 폭과 감김 방향 일치, Overlap 균일·들뜸 없음','육안/줄자','전수','조립시','테이핑 작업표준 대조','생산','재테이핑·재작업','조립 자주검사');
    add_item('H53','H53-01','하네스','분기 위치·타이밍',NULL,'분기 위치가 작업표준·도면과 일치하고 테이프 밀착','도면/줄자','전수','조립시','분기 타이밍 체크','생산','재조정·재작업','조립 CHECK SHEET');
    add_item('H54','H54-01','B/CABLE·CLIP','CLIP·STAY 체결·누락','HI','B/CABLE·CLIP·STAY 방향·수량·체결상태 일치','육안','전수','조립시','부품표·작업표준 대조','생산','부품 보충·재작업','조립 CHECK SHEET');
    add_item('H56','H56-01','프로텍터','프로텍터 방향·완전 체결',NULL,'프로텍터 균열·변형 없고 지정 위치에 완전 체결','육안','전수','조립시','JIG·작업표준 대조','생산','재체결·부품 교체','조립 CHECK SHEET');
    add_item('H57','H57-01','하네스','체결 토크','CC','차종별 토크 기준 만족, 체결 누락·과토크 없음','토크렌치/토크시스템','초·중·종물 1EA','조건변경시/LOT','토크 측정값 전산 기록','품질','격리·재체결·보전 호출','토크 검사기록');
    add_item('I50','I50-01','하네스','회로 통전·단선·쇼트','CC','회로번호·제품과 일치, 누락·단선·쇼트 없음','하네스테스터','전수','검사시','자동검사 결과 저장','품질','불합격 격리·재작업','통합회로검사 기록');
    add_item('I50','I50-02','하네스','기밀시험·리크','CC','0.7±0.2bar 충전 후 0.3bar 2초 유지','기밀시험기','전수','검사시','리크 측정값 자동 기록','품질','격리·누설 원인 제거','기밀시험 기록');
    add_item('I50','I50-03','고전압 케이블','내전압','CC','DC 3.0kV / 2.0mA 이하','내전압 검사기','전수','검사시','검사기 결과 자동 기록','품질','불합격 격리·재작업','내전압 검사기록');
    add_item('L50','L50-01','완성 하네스','ALC/BAR·누락·구조·DIM','HI','ALC/BAR 코드, 부품 누락·구조·DIM’S 기준 만족','육안/검사기','전수','최종검사시','최종 CHECK SHEET 기록','품질','부적합 FLOW·재검사','최종검사 기록');
    add_item('M50','M50-01','완성 하네스','포장·라벨·BOX 수량',NULL,'제품·라벨·납품 BOX 수량 일치, BOX 손상·덮개 이상 없음','육안/ERP','전수','포장시','포장 CHECK SHEET·ERP 등록','물류/품질','재포장·라벨 재발행','포장 기록');
    add_item('P50','P50-01','완성 하네스','출하 품번·수량·BOX',NULL,'납품차·납품BOX·BOX 덮개 및 출하 수량 일치','육안/ERP','전수','출하시','출하검사·ERP 확정','물류/품질','출하 보류·재확인','출하 기록');

    INSERT INTO QUALITY_PLAN_PARTICIPANTS
      (PARTICIPANT_ID, REVISION_ID, COMPANY, PLANT_CD, ROLE, USER_ID, USER_NAME, ORGANIZATION)
    VALUES (SEQ_QUALITY_PLAN_PARTICIPANT.NEXTVAL, l_pfmea_rev, '40', '1000', 'KEY_CONTACT', NULL, '하네스 품질담당', '품질보증팀');
    INSERT INTO QUALITY_PLAN_PARTICIPANTS
      (PARTICIPANT_ID, REVISION_ID, COMPANY, PLANT_CD, ROLE, USER_ID, USER_NAME, ORGANIZATION)
    VALUES (SEQ_QUALITY_PLAN_PARTICIPANT.NEXTVAL, l_pfmea_rev, '40', '1000', 'KEY_CONTACT', NULL, '생산기술 담당', '생산기술팀');
  END IF;
  COMMIT;
END;
/
