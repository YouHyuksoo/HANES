-- 자재 LOT 제조일자 백필 (2026-09-16)
--
-- 배경: MAT_LOTS.MANUFACTURE_DATE 가 427건 중 409건 비어 있다. 입하 화면에서
--       제조일자가 선택 입력이라 대부분 그냥 넘어갔다.
-- 방침: 실제 제조일자는 시스템 어디에도 없다. 사용자 결정에 따라 입고일(RECV_DATE)로
--       채운다. 업체가 표기한 실제 제조일자가 아니다.
-- 영향: 유효기간 기산점은 resolveShelfLifeBaseDate 가 manufactureDate ?? recvDate 로
--       정하므로(fifo.rules.ts), 지금까지 입고일을 쓰던 LOT 은 기산점이 그대로다.
--       EXPIRE_DATE 재계산 결과도 동일해 이 백필로 만료일이 바뀌지 않는다.
-- 대상: MANUFACTURE_DATE IS NULL AND RECV_DATE IS NOT NULL — 409건

UPDATE MAT_LOTS
   SET MANUFACTURE_DATE = RECV_DATE,
       UPDATED_AT = SYSTIMESTAMP
 WHERE MANUFACTURE_DATE IS NULL
   AND RECV_DATE IS NOT NULL
/

COMMIT
/
