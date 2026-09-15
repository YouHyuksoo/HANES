-- 검증용으로 남은 통합검사 기록 제거 (사용자 지시, 2026-09-15)
--
-- 배경: 통합검사 저장 경로가 한 번도 동작하지 않던 것(과발행 가드 오작동)을 고친 뒤,
--       실제로 저장되는지 확인하려고 FG26090400413 에 5스텝 합격 검사를 한 건 태웠다.
--       실물을 검사한 것이 아니므로 품질기록으로 남겨두지 않는다.
--
-- 대상: INSPECT_RESULTS 5행(IR26091501032~1036, CONTINUITY/LEAK/HIPOT/STRUCTURE/TORQUE)
--       FG_LABELS FG26090400413 의 판정 필드
--
-- 실행 전 값(복구용 기록):
--   FG_LABELS FG26090400413: STATUS='ISSUED', INSPECT_PASS_YN='Y', STRUCTURE_YN='Y',
--                            INSPECT_RESULT_ID='IR26091501032'
--   검사 직전 원래 값: INSPECT_PASS_YN=NULL, STRUCTURE_YN=NULL, INSPECT_RESULT_ID=NULL
--
-- 참조 확인: FG_LABELS 1건만 이 검사행을 참조. REPAIR_ORDERS 0건.
-- 순서: 참조를 먼저 끊고(라벨 원복) 검사행을 지운다.

UPDATE FG_LABELS
   SET INSPECT_PASS_YN = NULL,
       STRUCTURE_YN = NULL,
       INSPECT_RESULT_ID = NULL,
       UPDATED_BY = 'verify-cleanup',
       UPDATED_AT = SYSTIMESTAMP
 WHERE FG_BARCODE = 'FG26090400413'
   AND COMPANY = '40'
/

DELETE FROM INSPECT_RESULTS
 WHERE FG_BARCODE = 'FG26090400413'
   AND COMPANY = '40'
   AND RESULT_NO IN ('IR26091501032','IR26091501033','IR26091501034','IR26091501035','IR26091501036')
/

COMMIT
/
