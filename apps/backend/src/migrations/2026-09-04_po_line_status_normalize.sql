-- 2026-09-04 구매발주 라인 상태(PURCHASE_ORDER_ITEMS.LINE_STATUS) 정규화
-- 정본 어휘: COM_CODES.PO_LINE_STATUS = OPEN / PARTIAL / CLOSE
-- 규칙(@harness/shared derivePurchaseOrderLineStatus): RECEIVED_QTY<=0 → OPEN, >=ORDER_QTY → CLOSE, 그 외 PARTIAL
-- 배경: PO 입하(createPoArrival)·입하취소 경로가 RECEIVED_QTY 만 갱신하고 LINE_STATUS 를 갱신하지 않아
--       수량과 상태가 어긋난 행이 있었다(실측 1건: PO-N91-260702-003 LINE_NO 18, 전량 입하인데 PARTIAL).
-- 헤더(PURCHASE_ORDERS.STATUS)는 실측 결과 정본 외 값·수량 불일치가 없어 건드리지 않는다.
UPDATE PURCHASE_ORDER_ITEMS
   SET LINE_STATUS = CASE
                       WHEN NVL(RECEIVED_QTY, 0) <= 0 THEN 'OPEN'
                       WHEN NVL(RECEIVED_QTY, 0) >= ORDER_QTY THEN 'CLOSE'
                       ELSE 'PARTIAL'
                     END
 WHERE NVL(LINE_STATUS, 'OPEN') <> CASE
                                     WHEN NVL(RECEIVED_QTY, 0) <= 0 THEN 'OPEN'
                                     WHEN NVL(RECEIVED_QTY, 0) >= ORDER_QTY THEN 'CLOSE'
                                     ELSE 'PARTIAL'
                                   END
/
COMMIT
/
