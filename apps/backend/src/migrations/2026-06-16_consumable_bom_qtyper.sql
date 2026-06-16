-- 소모품 BOM 소요율(QTY_PER) 조정: 1.0 → 0.001 (1000개 생산당 1개 소모)
-- 배경: 소모품을 일반 자재로 통합 처리하면 실적 완료 시 auto-issue가
--       QTY_PER × 생산수량만큼 재고를 차감한다. 소모품은 1개로 다량 생산하므로
--       소요율을 실제 소모율로 낮춰 과도 차감을 막는다.
-- 주의: 품목별 실제 수명이 다르면 개별 조정 필요(소요율 = 1 / 수명).
-- 사이트: JSHANES, COMPANY=40
UPDATE BOM_MASTERS
SET QTY_PER = 0.001
WHERE COMPANY = '40'
  AND CHILD_ITEM_CODE IN (
    'APPCT-A','APPCT-B','APPCT-SE',
    'CUTBL001','CUTBL002','CUTBL003','CUTBL004','CUTBL009',
    'JIGHD-A','JIGHD-B','JIGHD-C','JIGHD-D'
  )
/
