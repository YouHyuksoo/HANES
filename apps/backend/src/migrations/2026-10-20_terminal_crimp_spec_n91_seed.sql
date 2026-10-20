-- 단자별 압착 규격 임시 시드 — N91H00-X9800-S-A 양단압착(CRMPB/CRMPB-HV) 단자 3종 — JSHANES (40/1000)
-- 근거: BOM_MASTERS N91H00-X9800-S-A 의 TERMINAL 자품목 3종 + 4단계 아래 C1-A/C2-A 의 전선 1SH21A7A09(3.0 SQ).
-- 수치는 단자 제조사 압착 사양서가 없어 3.0SQ 일반값으로 넣은 임시 시드값이다. 사양서 확정 시 화면에서 수정한다.
-- 링 단자(DLMLS6-3-3, EKEESNATBC)는 절연부 배럴이 없어 절연부 압착고를 두지 않는다.

MERGE INTO TERMINAL_CRIMP_SPECS t
USING (
  SELECT '40' COMPANY, '1000' PLANT_CD, terminal_item_code, '3.0SQ' wire_size, '1SH21A7A09' wire_item_code,
         ch_lsl, ch_usl, cw_lsl, cw_usl, ich_lsl, ich_usl, pull_min, strip_min, strip_max,
         '임시 시드값: 기준서 확정 전 검증용. N91H00-X9800-S-A CRMPB BOM 연결 근거.' remark
  FROM (
    SELECT 'TKEG1WFSCD' terminal_item_code, 2.00 ch_lsl, 2.20 ch_usl, 3.50 cw_lsl, 3.70 cw_usl, 3.60 ich_lsl, 4.00 ich_usl, 300 pull_min, 5.0 strip_min, 6.0 strip_max FROM DUAL UNION ALL
    SELECT 'DLMLS6-3-3', 2.10, 2.30, 3.80, 4.00, NULL, NULL, 300, 6.0, 7.0 FROM DUAL UNION ALL
    SELECT 'EKEESNATBC', 2.00, 2.20, 3.60, 3.80, NULL, NULL, 300, 6.0, 7.0 FROM DUAL
  )
) s
ON (t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD
    AND t.TERMINAL_ITEM_CODE = s.terminal_item_code AND t.WIRE_SIZE = s.wire_size)
WHEN MATCHED THEN UPDATE SET
  t.WIRE_ITEM_CODE = s.wire_item_code,
  t.CRIMP_HEIGHT_LSL = s.ch_lsl, t.CRIMP_HEIGHT_USL = s.ch_usl,
  t.CRIMP_WIDTH_LSL = s.cw_lsl, t.CRIMP_WIDTH_USL = s.cw_usl,
  t.INS_CRIMP_HEIGHT_LSL = s.ich_lsl, t.INS_CRIMP_HEIGHT_USL = s.ich_usl,
  t.PULL_FORCE_MIN = s.pull_min,
  t.STRIP_LENGTH_MIN = s.strip_min, t.STRIP_LENGTH_MAX = s.strip_max,
  t.REMARK = s.remark,
  t.USE_YN = 'Y',
  t.UPDATED_BY = 'seed',
  t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  SPEC_ID, COMPANY, PLANT_CD, TERMINAL_ITEM_CODE, TERMINAL_TYPE, WIRE_SIZE, WIRE_ITEM_CODE,
  CRIMP_HEIGHT_LSL, CRIMP_HEIGHT_USL, CRIMP_WIDTH_LSL, CRIMP_WIDTH_USL,
  INS_CRIMP_HEIGHT_LSL, INS_CRIMP_HEIGHT_USL, PULL_FORCE_MIN,
  STRIP_LENGTH_MIN, STRIP_LENGTH_MAX, APPLICATOR_CODE, REMARK, USE_YN,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  SEQ_TERMINAL_CRIMP_SPEC.NEXTVAL, s.COMPANY, s.PLANT_CD, s.terminal_item_code, NULL, s.wire_size, s.wire_item_code,
  s.ch_lsl, s.ch_usl, s.cw_lsl, s.cw_usl, s.ich_lsl, s.ich_usl, s.pull_min,
  s.strip_min, s.strip_max, NULL, s.remark, 'Y',
  'seed', 'seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

COMMIT
/
