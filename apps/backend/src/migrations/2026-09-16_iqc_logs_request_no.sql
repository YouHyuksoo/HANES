-- IQC_LOGS에 검사의뢰 LOT 번호 컬럼 추가
--
-- 배경(2026-09-16 유기성 점검 E): 의뢰 LOT 판정 이력과 의뢰의 연결이 REMARK의
-- '[IQL:<의뢰번호>]' 문자열뿐이었다. 역추적이 LIKE 검색으로만 가능하고, REMARK는
-- 사용자 입력 비고와 같은 칸이라 덮어써질 위험도 있다.
--
-- REQUEST_NO는 IQC_REQUEST_LOTS.REQUEST_NO와 같은 VARCHAR2(50)로 맞춘다.
-- 입하단위/단건 판정 이력에는 NULL이다(의뢰 LOT 판정에만 채워진다).
--
-- 의존 객체: PACKAGE BODY PKG_WORKFLOW가 IQC_LOGS를 참조한다.
-- 테이블 DDL이 이 패키지를 INVALID로 만들고, 다음 호출에서 ORA-04068이 1회 발생한다.
-- 그래서 DDL 직후 명시적으로 재컴파일한다.

ALTER TABLE IQC_LOGS ADD (REQUEST_NO VARCHAR2(50))
/

COMMENT ON COLUMN IQC_LOGS.REQUEST_NO IS '검사의뢰 LOT 번호 (IQC_REQUEST_LOTS.REQUEST_NO). 의뢰 LOT 단위 판정에만 채워지고 입하단위/단건 판정은 NULL'
/

CREATE INDEX IX_IQC_LOGS_REQUEST_NO ON IQC_LOGS (COMPANY, PLANT_CD, REQUEST_NO)
/

-- 기존 이력 백필: REMARK의 '[IQL:...]' 접두어에서 의뢰번호를 뽑는다.
-- JSHANES 적용 시점 대상 0건(이전 검증 데이터가 전량 원복된 상태). 다른 사이트 적용을 위해 남긴다.
UPDATE IQC_LOGS
   SET REQUEST_NO = REGEXP_SUBSTR(REMARK, '\[IQL:([^]]+)\]', 1, 1, NULL, 1)
 WHERE REQUEST_NO IS NULL
   AND REMARK LIKE '%[IQL:%'
/

COMMIT
/

ALTER PACKAGE PKG_WORKFLOW COMPILE BODY
/
