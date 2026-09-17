-- IQC 판정 대상(IQC_LOG_TARGETS) 신설 — ADR 0004
--
-- 배경: 수입검사의 검사 단위가 세 가지(자재 시리얼 단건 / 입하번호+품목 / 검사의뢰)로 늘면서
--       판정 1건이 실제로 덮은 입하 행을 IQC_LOGS.ARRIVAL_NO 한 컬럼이 겸해 표현할 수 없게 됐다.
--       검사의뢰 판정은 시료 행의 입하번호만 남기고 대표 행을 잃는다.
--       판정↔입하 행 역추적의 정본을 이 테이블로 옮긴다.
--
-- 한 행의 단위는 입하 행(ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE)이고
-- MAT_UID는 자재 시리얼 단건 판정일 때만 채운다.
--
-- 적용: 2026-09-17 JSHANES 적용 완료.
--   pre  : IQC_LOGS 160건 (MAT_UID 18 / REQUEST_NO 0 / ARRIVAL_NO NULL 0), IQC_REQUEST_LOTS 0건
--          고아 판정 0건(단건 18건 전부 MAT_LOTS 매칭, 입하단위 142건 전부 MAT_ARRIVALS 매칭)
--   post : IQC_LOG_TARGETS 278행(단건 18 + 입하단위 260), 판정 160건 전부 대상 보유,
--          대상 없는 판정 0건.
--   검사의뢰 데이터가 0건이므로 과거 판정 범위가 "그 입하번호+품목 전체"임이 확정된다.
--   백필은 근사치가 아니라 정확하다.
--
-- 실행: oracle-db --site JSHANES --execute-file 로 이 파일을 통째로 적용한다.
--       각 문장은 '/' 라인으로 분리돼 있고 9개 블록이 순서대로 실행된다.
--
-- 배포 구간 재실행(중요): ARRIVAL_NO 폴백을 남기지 않으므로, 마이그레이션 적용과
--   코드 배포 사이에 구 코드가 만든 판정에는 판정 대상이 없다. 역조회가 조용히
--   "판정 없음"을 돌려주고, 입하취소 가드에서는 그게 곧 가드 열림이다(ADR 0004).
--   백필 INSERT 2개는 NOT EXISTS로 멱등하게 만들어 뒀다. **코드 배포 직후 백필 2개를
--   한 번 더 실행**하고 아래 쿼리가 0인지 확인한다. RETEST(ARRIVAL_NO IS NULL)는
--   시리얼 스코프 판정이라 판정 대상을 갖지 않으므로 제외한다.
--   백필 2는 검사의뢰 판정(REQUEST_NO NOT NULL)을 반드시 제외한다 — 아래 주석 참고.
--   재실행 전후로 이 쿼리도 같이 본다(의뢰 판정의 대상 수가 변하면 안 된다):
--     SELECT g.REQUEST_NO, COUNT(*) FROM IQC_LOG_TARGETS t JOIN IQC_LOGS g
--       ON g.INSPECT_DATE=t.INSPECT_DATE AND g.SEQ=t.SEQ
--      WHERE g.REQUEST_NO IS NOT NULL GROUP BY g.REQUEST_NO;
--
--   SELECT COUNT(*) FROM IQC_LOGS g
--    WHERE g.ARRIVAL_NO IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM IQC_LOG_TARGETS t
--                       WHERE t.INSPECT_DATE = g.INSPECT_DATE AND t.SEQ = g.SEQ);

CREATE TABLE IQC_LOG_TARGETS (
  INSPECT_DATE TIMESTAMP(6) NOT NULL,
  SEQ NUMBER NOT NULL,
  ARRIVAL_NO VARCHAR2(100) NOT NULL,
  ARRIVAL_SEQ NUMBER DEFAULT 1 NOT NULL,
  ITEM_CODE VARCHAR2(100) NOT NULL,
  MAT_UID VARCHAR2(50),
  COMPANY VARCHAR2(50) NOT NULL,
  PLANT_CD VARCHAR2(50) NOT NULL,
  CONSTRAINT PK_IQC_LOG_TARGETS PRIMARY KEY (INSPECT_DATE, SEQ, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE)
)
/
COMMENT ON TABLE IQC_LOG_TARGETS IS 'IQC 판정 대상. 판정 1건(IQC_LOGS)이 실제로 덮은 입하 행 목록이며 판정-입하행 역추적의 정본이다. IQC_REQUEST_LOT_LINES(판정 전 계획)와 합치지 말 것.'
/
COMMENT ON COLUMN IQC_LOG_TARGETS.ARRIVAL_SEQ IS '입하 행 순번(MAT_ARRIVALS.SEQ). ARRIVAL_NO 단독으로는 입하 행이 유일하지 않다.'
/
COMMENT ON COLUMN IQC_LOG_TARGETS.MAT_UID IS '자재 시리얼 단건 판정일 때만 채운다. 입하단위/의뢰 판정에서는 NULL.'
/
CREATE INDEX IX_IQC_LOG_TGT_ARR ON IQC_LOG_TARGETS (COMPANY, PLANT_CD, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE)
/
CREATE INDEX IX_IQC_LOG_TGT_UID ON IQC_LOG_TARGETS (COMPANY, PLANT_CD, MAT_UID)
/
-- 백필 1) 자재 시리얼 단건 판정 — 그 시리얼이 달린 입하 행 하나
INSERT INTO IQC_LOG_TARGETS (INSPECT_DATE, SEQ, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE, MAT_UID, COMPANY, PLANT_CD)
SELECT g.INSPECT_DATE, g.SEQ, l.ARRIVAL_NO, NVL(l.ARRIVAL_SEQ, 1), l.ITEM_CODE, l.MAT_UID, g.COMPANY, g.PLANT_CD
  FROM IQC_LOGS g
  JOIN MAT_LOTS l
    ON l.MAT_UID = g.MAT_UID AND l.COMPANY = g.COMPANY AND l.PLANT_CD = g.PLANT_CD
 WHERE g.MAT_UID IS NOT NULL
   AND l.ARRIVAL_NO IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM IQC_LOG_TARGETS t
      WHERE t.INSPECT_DATE = g.INSPECT_DATE AND t.SEQ = g.SEQ
        AND t.ARRIVAL_NO = l.ARRIVAL_NO AND t.ARRIVAL_SEQ = NVL(l.ARRIVAL_SEQ, 1) AND t.ITEM_CODE = l.ITEM_CODE
   )
/
-- 백필 2) 입하단위 판정 — 그 입하번호+품목의 모든 입하 행
--
-- REQUEST_NO IS NULL 조건이 **필수**다. 검사의뢰 판정도 MAT_UID가 NULL이라,
-- 이 조건이 없으면 의뢰 판정을 입하단위로 오인해 그 판정의 범위를 입하번호 전체로 덮어쓴다.
-- 최초 백필 때는 검사의뢰가 0건이라 문제가 없었지만, 재실행 절차로 쓰는 순간 깨진다.
-- (2026-09-18 실측: 배포 후 재실행에서 의뢰 판정 대상이 3행 → 50행으로 부풀었다. 복구함.)
INSERT INTO IQC_LOG_TARGETS (INSPECT_DATE, SEQ, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE, MAT_UID, COMPANY, PLANT_CD)
SELECT DISTINCT g.INSPECT_DATE, g.SEQ, a.ARRIVAL_NO, a.SEQ, a.ITEM_CODE, NULL, g.COMPANY, g.PLANT_CD
  FROM IQC_LOGS g
  JOIN MAT_ARRIVALS a
    ON a.ARRIVAL_NO = g.ARRIVAL_NO AND a.ITEM_CODE = g.ITEM_CODE
   AND a.COMPANY = g.COMPANY AND a.PLANT_CD = g.PLANT_CD
 WHERE g.MAT_UID IS NULL
   AND g.REQUEST_NO IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM IQC_LOG_TARGETS t
      WHERE t.INSPECT_DATE = g.INSPECT_DATE AND t.SEQ = g.SEQ
        AND t.ARRIVAL_NO = a.ARRIVAL_NO AND t.ARRIVAL_SEQ = a.SEQ AND t.ITEM_CODE = a.ITEM_CODE
   )
/
COMMIT
/
