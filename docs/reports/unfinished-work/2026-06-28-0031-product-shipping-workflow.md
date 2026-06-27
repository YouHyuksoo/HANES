# 미완료 작업 기록: 제품수불관리 및 출하관리 상태전이 점검

- 작성시각: 2026-06-28 00:31 KST
- 작성자: codex
- 작업 범위: 제품수불관리, 제품재고/실사/보류, 출하관리
- 현재 상태: 해결완료

## 완료한 것

- JSHANES 기준 제품/출하 상태전이 정합성 23개 항목을 점검했다.
- 제품재고 음수/가용수량 불일치, 박스-라벨 상태 불일치, 팔레트 집계 불일치, 출하지시 출하수량 역전 등은 0건이었다.
- `/shipping/customer-po-status`가 존재하지 않는 `/shipping/customer-order-status`를 호출하던 문제를 `/shipping/customer-orders/status`로 보정했다.
- 제품/출하 서비스 테스트 9개 suite, 138개 테스트 통과를 확인했다.

## 미완료 / 남은 것

- 최초 중단 시점에는 `PRODUCT_TRANSACTIONS`에 `FG_OUT_CANCEL` 1건이 원본 `FG_OUT`과 `CANCEL_REF_ID`로 연결되지 않은 상태였다.
- 사용자 진행 허가 후 `apps/backend/src/modules/shipping/services/ship-order.service.ts`의 `cancelShipBoxInTx()`를 수정해 원본 `FG_OUT`을 찾아 `ProductInventoryService.cancelTransactionInTx()`로 취소하도록 보강했다.
- `apps/backend/src/migrations/2026-06-28_fix_ship_order_cancel_product_tx_link.sql`로 레거시 row `PTX2026062600004`/`PTX2026062600005`를 보정했다.
- 보정 후 `PRODUCT_CANCEL_ORPHAN`은 0건이다.

## 변경 파일

- `apps/frontend/src/app/(authenticated)/shipping/customer-po-status/page.tsx`: 고객발주현황 API 경로 보정
- `apps/backend/src/modules/inventory/services/product-physical-inv.service.spec.ts`: 현재 서비스 생성자에 맞춰 테스트 repository mock 보강
- `apps/backend/src/modules/shipping/services/ship-order.service.ts`: 출하지시 박스출하 취소 시 원본 `FG_OUT` 기반 표준 수불 취소로 변경
- `apps/backend/src/modules/shipping/services/ship-order.service.spec.ts`: 출하지시 박스출하 취소 수불 연결 테스트 보강
- `apps/backend/src/migrations/2026-06-28_fix_ship_order_cancel_product_tx_link.sql`: 레거시 제품수불 취소 연결 보정
- `docs/reports/unfinished-work/2026-06-28-0031-product-shipping-workflow.md`: 남은 출하취소 원장 결함 기록

## 검증 상태

- 실행함: JSHANES 상태전이 정합성 SQL 23개 항목 재실행, 23개 모두 0건
- 실행함: `node .\node_modules\jest\bin\jest.js --runInBand ...` 제품/출하 서비스 테스트 9 suite, 138 tests PASS
- 실행함: 제품/출하 조회 API 18개 endpoint 200 확인
- 실행함: 백엔드 TypeScript `tsc --noEmit --pretty false` 통과
- 실행함: 프론트엔드 TypeScript `tsc --noEmit --pretty false` 통과
- 실행함: `git diff --check` 통과

## 중단 사유

- 최초 중단 사유는 `ship-order.service.ts`가 다른 AI active lock 범위에 포함되어 있어 사용자 허가 없이 수정하지 않은 것이다.
- 이후 사용자가 `진행해`라고 명시해 코드 수정과 DB 보정을 완료했다.

## 다음 작업자가 바로 할 일

1. 추가 작업 없음.
2. 다른 세션에서 동일 파일을 수정 중이었다면 이 기록과 현재 diff를 기준으로 충돌 여부만 확인한다.

## 주의사항

- 현재 박스/라벨/재고 수량은 복원되어 있다. 깨진 것은 수불 원장의 원본-취소 연결이다.
- 사용자 또는 다른 AI의 기존 dirty work를 되돌리지 않는다.
- API 검증 계정은 `admin@hanes.com / admin123`, company `40`, plant `1000`을 사용했다.
