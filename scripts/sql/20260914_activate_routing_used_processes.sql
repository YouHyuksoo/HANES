-- 라우팅에서 실제로 쓰이는 공정 6건을 사용중으로 정정한다.
-- 라우팅에 편성돼 있으면 그 공정은 사용 중이다. USE_YN='N' + 이름의 "(미사용)" 표기가
-- 실제와 어긋나 있었고, 화면의 공정 선택 목록(USE_YN='Y' 기준)에서 빠져 있었다.
-- 대상: CONAS 커넥터체결 / CRMPF 전단압착 / FINSH 마무리 / FINSP 최종검사
--       SACMB 반제품조합 / SGINS 반제품검사
UPDATE PROCESS_MASTERS
   SET USE_YN = 'Y',
       PROCESS_NAME = REPLACE(PROCESS_NAME, '(미사용)', ''),
       UPDATED_AT = SYSTIMESTAMP
 WHERE PROCESS_CODE IN ('CONAS', 'CRMPF', 'FINSH', 'FINSP', 'SACMB', 'SGINS')
   AND COMPANY = '40'
   AND PLANT_CD = '1000'
/
COMMIT
/
