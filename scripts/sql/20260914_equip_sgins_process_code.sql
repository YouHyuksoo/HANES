-- EQ-SGINS-01(반제품 검사대)에 SGINS(반제품검사) 공정을 배정한다.
-- 근거: 설비명/코드가 공정과 일치하고, SGINS 는 라우팅 RT_N91H00-X9800-R-S(SEQ 50)에서 실제 사용 중이다.
-- 공정 미지정 설비는 실적 화면에서 작업지시를 고를 수 없고, 설비점검 인터록 판정에도 영향이 있다.
UPDATE EQUIP_MASTERS
   SET PROCESS_CODE = 'SGINS',
       UPDATED_AT = SYSTIMESTAMP
 WHERE EQUIP_CODE = 'EQ-SGINS-01'
   AND COMPANY = '40'
   AND PLANT_CD = '1000'
/
COMMIT
/
