-- 2026-06-26 PROCESS_MASTERS LINE_TYPE 미분류 10건 분류
-- 배경: PROCESS_MASTERS.LINE_TYPE(공통코드 LINE_TYPE: LV/HV/CM)이 NULL인 공정 10건 존재.
--       LINE_TYPE 공통코드 자체는 이미 시드/UI 완비됨(데이터 분류 누락만 보완).
-- 규칙: 기존 54건 분류 패턴을 따른다.
--       - 비-KS 전선가공(절단/탈피/일반압착) → LV (양단/전단/후단압착·자동절단·탈피가 모두 LV)
--       - 조립/준비/체결/검사(공통작업) → CM
-- 재실행 안전: LINE_TYPE IS NULL 가드(이미 채워진 행은 건드리지 않음).
-- 사이트: JSHANES (COMPANY=40, PLANT_CD=1000)

-- 1) CM(공통) — 조립/준비/체결 + 검사
UPDATE PROCESS_MASTERS SET LINE_TYPE='CM', UPDATED_BY='claude', UPDATED_AT=SYSTIMESTAMP
WHERE PROCESS_CODE IN ('CONAS','EXTAS','MATPR','FINSP','PRC-TEST','SGINS')
  AND LINE_TYPE IS NULL;
/

-- 2) LV(저전압) — 전선가공(절단/탈피/일반압착)
UPDATE PROCESS_MASTERS SET LINE_TYPE='LV', UPDATED_BY='claude', UPDATED_AT=SYSTIMESTAMP
WHERE PROCESS_CODE IN ('PRC-CUT','PRC-STRIP','GCRMP','PRC-CRIMP')
  AND LINE_TYPE IS NULL;
/
