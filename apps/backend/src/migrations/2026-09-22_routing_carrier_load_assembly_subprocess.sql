-- 조립·서브공정 라우팅 공정의 대차 적재(CARRIER_LOAD_YN) 를 켠다
--
-- 왜:
--   실적입력(조립)·(서브공정) 화면의 대차 스캔칸이 보이지 않았다. 화면은 정상이고,
--   OutputCarrierSlot 이 공정의 CARRIER_LOAD_YN='Y' 일 때만 스캔칸을 그리기 때문이다.
--   2026-09-22 실측 결과 라벨 발행 공정 16건이 전부 'N' 이었다.
--
-- 대상 판정(2026-09-22 실측):
--   - 백엔드 규칙 routing-carrier-flag.rules.ts: 대차 적재는 BUNDLE/SG/FG 발행 공정에서만 켤 수 있다.
--   - FG(2건)    = 조립     — N91H00-X9800/MASSY(조립), RT_N91H00-X9800-R/FINSH(마무리)
--   - SG(6건)    = 서브공정 — MAG_*/GCRMP(일반압착) 5건, RT_N91H00-X9800-R-S/SACMB(반제품조합)
--   - BUNDLE(8건)= 서브공정 — subprocess-kitting.service.issueSgLabel 이
--                  `step.issueLabelType === 'BUNDLE' ? 'BUNDLE' : 'SG'` 로 BUNDLE 도 발행한다.
--                  실드절단/자동절단탈피/열수축/양단압착/육각압착/압착준비.
--   - ISSUE_LABEL_TYPE='NONE' 인 공정(절압물검사 등)은 규칙상 켤 수 없어 제외된다.
--
-- 멀티테넌시 정본: COMPANY='40', PLANT_CD='1000' (대상 16건 모두 이 tenant).
-- 멱등: 이미 'Y' 인 행은 조건에서 빠지므로 재실행해도 건수가 늘지 않는다.
--
-- CARRIER_AUTO_INPUT_YN(대차 스캔 시 담긴 라벨 일괄 투입)은 건드리지 않는다.
--   지시 범위 밖이고, 켜면 스캔 한 번에 여러 라벨이 투입되어 동작이 달라진다.
--   현재 MASSY 한 건만 'Y' 다.

UPDATE ROUTING_PROCESSES
   SET CARRIER_LOAD_YN = 'Y',
       UPDATED_AT      = SYSTIMESTAMP,
       UPDATED_BY      = 'system'
 WHERE COMPANY  = '40'
   AND PLANT_CD = '1000'
   AND ISSUE_LABEL_TYPE IN ('BUNDLE', 'SG', 'FG')
   AND NVL(CARRIER_LOAD_YN, 'N') <> 'Y'
/

COMMIT
/
