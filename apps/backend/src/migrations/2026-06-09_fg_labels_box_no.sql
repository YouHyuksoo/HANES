-- 2026-06-09 FG_LABELS.BOX_NO 추가
-- 목적: 제품재고(시리얼) 테이블에 박스번호 컬럼을 추가하여, 입고 시점에 박스 시리얼에
--       박스번호를 스탬프한다. box-stock 화면이 BOX_MASTERS(박스 포장 테이블)가 아니라
--       FG_LABELS(시리얼=제품재고) 하나만으로 "박스별 재고 / 박스 내 시리얼"을 표현한다.
-- 재고 정의: BOX_NO IS NOT NULL AND STATUS <> 'SHIPPED'  (입고됨 + 미출하)

ALTER TABLE FG_LABELS ADD (BOX_NO VARCHAR2(50));
/
CREATE INDEX IX_FG_LABELS_BOX_NO ON FG_LABELS (BOX_NO);
/
-- 기존 입고분 백필: 입고완료(DONE FG_IN/WIP_IN) + 미출하 박스의 시리얼에 BOX_NO 부여
UPDATE FG_LABELS l
SET l.BOX_NO = (
  SELECT MIN(b.BOX_NO)
  FROM BOX_MASTERS b
  WHERE b.SERIAL_LIST IS NOT NULL
    AND b.STATUS <> 'SHIPPED'
    AND EXISTS (
      SELECT 1 FROM JSON_TABLE(b.SERIAL_LIST, '$[*]' COLUMNS (sn VARCHAR2(30) PATH '$')) jt
      WHERE jt.sn = l.FG_BARCODE
    )
    AND EXISTS (
      SELECT 1 FROM PRODUCT_TRANSACTIONS t
      WHERE t.REF_TYPE = 'BOX' AND t.REF_ID = b.BOX_NO
        AND t.TRANS_TYPE IN ('FG_IN','WIP_IN') AND t.STATUS = 'DONE'
    )
)
WHERE l.STATUS <> 'SHIPPED'
  AND EXISTS (
    SELECT 1 FROM BOX_MASTERS b
    WHERE b.SERIAL_LIST IS NOT NULL
      AND b.STATUS <> 'SHIPPED'
      AND EXISTS (
        SELECT 1 FROM JSON_TABLE(b.SERIAL_LIST, '$[*]' COLUMNS (sn VARCHAR2(30) PATH '$')) jt
        WHERE jt.sn = l.FG_BARCODE
      )
      AND EXISTS (
        SELECT 1 FROM PRODUCT_TRANSACTIONS t
        WHERE t.REF_TYPE = 'BOX' AND t.REF_ID = b.BOX_NO
          AND t.TRANS_TYPE IN ('FG_IN','WIP_IN') AND t.STATUS = 'DONE'
      )
  );
/
COMMIT;
/
