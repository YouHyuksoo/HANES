# DECISIONS

Record durable technical or operational decisions here.

Format:

```md
## D-000 Short title
Status: Accepted | Proposed | Rejected
Decision:
- Decision text
Reason:
- Reason text
```

## D-20260611-PDA-SHIPPING-BOX-ONLY
Status: Accepted
Decision:
- PDA 출하처리는 박스 단위(`POST /shipping/orders/:id/ship-box`)만 지원한다. 팔레트 바코드 스캔은 `PALLET_NOT_SUPPORTED`로 안내하고, 팔레트 단위 출하는 웹 출하확정(shipment mark-shipped) 경로를 사용한다.
- PDA 팔레트 단위 출하는 TODO로 남긴다(코드 마커 `TODO(T-PDA-PALLET-SHIP)`, `useShippingScan.ts`). 지원하려면 출하지시-팔레트 연계 백엔드 설계(shipment 자동 생성 또는 ship-pallet 엔드포인트)가 선행돼야 한다.
Reason:
- 백엔드 `ShipOrderService.shipBox()`는 이중 차감 방지를 위해 팔레트 적재 박스를 거부하므로, 기존 PDA의 "팔레트 → 하위 박스별 ship-box" 방식은 구조적으로 항상 실패한다. 별도 설계 없이 우회하면 재고 이중 차감 위험이 있다.

## D-20260609-MAT-RECEIVE-VENDOR-BARCODE
Status: Accepted
Decision:
- 자재입고 스캔 시 거래처/제조사 부착 바코드 원본은 `MAT_RECEIVINGS.VENDOR_BARCODE`에 입고 행 단위로 저장한다.
Reason:
- `VENDOR_BARCODE_MAPPINGS`는 기준정보 성격의 품목 매핑 테이블이고, 이번 요구는 실제 입고 시 스캔한 거래처 바코드와 자체 `matUid`의 실적 매핑을 남기는 것이므로 입고 이력에 직접 저장하는 편이 조회와 감사 추적에 맞다.
