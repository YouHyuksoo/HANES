# 박스별출하 화면 재구성 설계 (`/shipping/confirm`)

- 작성일: 2026-06-22
- 대상 화면: `apps/frontend/src/app/(authenticated)/shipping/confirm/`
- 범위: 프론트엔드 재구성 위주 (박스 단위 출하 백엔드 API는 기존 구현 재사용)

## 1. 배경 / 목적

기존 `/shipping/confirm`(메뉴: "출하작업")은 `OrderFulfillmentModal`을 통해 **팔레트 구성 → 팔레트 출하**를 수행한다. 그러나 팔레트 적재(`/shipping/pallet`)와 팔레트 출하(`/shipping/pallet-ship`)가 이미 별도 화면으로 존재하여 역할이 중복된다.

이 화면을 **박스(BOX) 단위 출하** 전용으로 재구성한다. 출하지시(Ship Order)를 선택하고, 해당 지시의 출하가능 박스를 스캔/선택하여 박스 단위로 즉시 출하 확정한다.

## 2. 결정 사항 (사용자 승인 완료)

1. **출하 기준**: 출하지시(Ship Order) 기준. 기존 `ship-box` API가 출하지시 라인의 `shippedQty`를 갱신하는 구조를 그대로 사용한다.
2. **레이아웃**: 좌(출하지시) / 중(출하가능 박스) / 우(박스 상세) 3-컬럼. `pallet-ship` 화면 패턴을 미러링한다.
3. **기존 요소 제거**: `OrderFulfillmentModal`(팔레트 구성 모달) 및 Shipment(SHIPMENT_LOGS) 목록 패널·관련 모달 제거.

## 3. 백엔드 계약 (기존, 변경 없음)

| 용도 | 엔드포인트 | 비고 |
|------|-----------|------|
| 미출하 출하지시 목록 | `GET /shipping/orders?status=CONFIRMED&limit=200` | `remainingQty>0` 프론트 필터 |
| 출하작업 현황 | `GET /shipping/orders/{id}/fulfillment` | `lines`, `candidateBoxes` 반환 |
| 박스 시리얼 상세 | `GET /shipping/box-stock/{boxNo}/serials` | 우측 패널 |
| 박스 단건 출하 | `POST /shipping/orders/{id}/ship-box` `{boxNo, workerId?}` | 단건 전용, 다건은 루프 |
| 박스 단건 출하취소 | `POST /shipping/orders/{id}/cancel-ship-box` `{boxNo}` | SHIPPED 박스만 |

### fulfillment 응답 핵심
- `lines`: `{ itemCode, itemName?, orderQty, shippedQty, remainingQty }[]`
- `candidateBoxes`: `{ boxNo, itemCode, qty, oqcStatus? }[]` — `status='CLOSED'` AND `oqcStatus='PASS'` AND `palletNo IS NULL` AND 잔여 품목 매칭, `createdAt ASC`, 최대 500건.

### ship-box 서버측 검증 (참고)
- 지시 `CONFIRMED`만 허용, 박스 `CLOSED`만, OQC_ENABLED 시 `oqcStatus='PASS'`만, 팔레트 미적재만, 라인 출하수량 초과 불가.
- 처리: 박스/시리얼 `SHIPPED`, FG 기본창고 수량 FIFO 차감, 라인 `shippedQty` 증가, 전 라인 완출 시 지시 `CLOSED`.

## 4. 알려진 제약 (프론트에서 흡수)

1. **후보 목록과 OQC 정책 불일치**: `candidateBoxes`는 항상 `oqcStatus='PASS'`만 포함하나, `ship-box`는 OQC_ENABLED일 때만 PASS를 강제한다. OQC 미사용 환경에서는 후보 목록이 실제 출하가능 박스보다 좁을 수 있다. → 본 작업에서는 후보 목록을 1차 기준으로 쓰되, 출하 처리의 최종 판정은 서버에 위임한다(스캔값이 후보에 없어도 명확한 안내 후 서버 호출 시도는 하지 않고, 후보 기준으로 가드한다). 백엔드 정합화는 별도 과제로 분리.
2. **출하완료 박스 조회 수단 없음**: `BoxMaster`에 `shipOrderNo` 컬럼이 없고 fulfillment도 SHIPPED 박스를 반환하지 않는다. → 출하취소는 **목록 없이 박스번호 스캔/입력 기반**으로 처리한다.

## 5. 화면 설계

### 5.1 레이아웃 (3-컬럼, `grid-cols-[340px_1fr_320px]`)

- **헤더**: 타이틀 "박스별출하" + 설명, 우측에 새로고침 / "박스출하 스캔" 버튼(지시 선택 + 출하가능 박스 1개 이상일 때 활성).
- **좌측 — 출하지시 목록**: `pallet-ship`의 카드 리스트 재사용. 항목당 지시번호 / 고객사 / 납기 / 잔여수량 표시. 클릭 시 선택 + fulfillment 로드.
- **중앙 — 출하가능 박스**: `DataGrid`. 상단에 라인 진행 요약(품목별 지시/기출하/잔여). 컬럼: 출하가능 아이콘 / 박스번호(mono) / 품목 / 수량 / OQC상태 배지. 행 클릭 → 우측 상세 표시 + 스캔목록 추가(토글). 데이터 = `candidateBoxes`.
- **우측 — 박스 상세**: 선택 박스의 시리얼 목록(`box-stock/{boxNo}/serials`). 미선택 시 안내 placeholder.

### 5.2 출하 스캔 모달 (다건)
- `pallet-ship`의 스캔 모달 패턴 미러링.
- 입력: 박스 바코드 스캔/엔터 → `candidateBoxes` 대조 가드(미존재 / 중복 / 잔여수량 초과 안내) → 스캔목록 누적.
- 중앙 그리드 행 클릭으로도 스캔목록에 추가 가능(스캐너 없는 환경 대비).
- "출하확정 (N개)" → 박스별 `ship-box` 순차 호출.
  - 각 박스는 독립 트랜잭션. 부분 실패 허용.
  - 완료 후 `성공 M / 실패 K`(실패 박스번호·사유) 요약 표시, fulfillment·지시목록 갱신.

### 5.3 출하취소 모달 (스캔 기반)
- "출하취소" 진입 → 박스번호 입력/스캔 → `cancel-ship-box` 호출(서버가 SHIPPED 검증·재고 복원).
- 성공 시 토스트/요약 후 fulfillment·지시목록 갱신.

### 5.4 상태/배지
- `@/components/shipping`의 `BoxStatusBadge` 재사용(OPEN/CLOSED/SHIPPED). OQC 상태는 텍스트/배지로 표시(파스텔 배경 금지 — 텍스트·테두리 구분).

## 6. 데이터 모델 (프론트 인터페이스)

```ts
interface ShipOrderSummary { shipOrderNo; customerName|null; dueDate|null; shipDate|null; status; /* items로 잔여 계산 */ }
interface OrderLine { itemCode; itemName?; orderQty; shippedQty; remainingQty }
interface CandidateBox { boxNo; itemCode; qty; oqcStatus?|null }
interface FulfillmentData { order; lines: OrderLine[]; candidateBoxes: CandidateBox[]; /* pallets/shipments 미사용 */ }
interface BoxSerial { seq; fgBarcode; itemCode; status; inspectPassYn; issuedAt; receivedAt }
```

## 7. 제거 / 정리

- 삭제: `apps/frontend/src/app/(authenticated)/shipping/confirm/OrderFulfillmentModal.tsx`.
- `page.tsx`에서 제거: Shipment 목록 패널, 상세/취소/역분개 모달, `ShipmentScanModal` 사용, `/shipping/shipments` 호출, 관련 상태.
- 유지: 라우트 `/shipping/confirm`, 메뉴코드 `SHIP_CONFIRM`.

## 8. i18n (ko/en/zh/vi 4파일 동시)

- 메뉴 라벨 `menu.shipping.confirm`: "출하작업" → "박스별출하"(en: "Box Shipping", zh: "按箱出货", vi: "Xuất hàng theo thùng" — 구현 시 확정).
- `shipping.confirm.*` 키 재정의/추가: 타이틀·설명·박스출하 스캔·출하확정·출하취소·가드 메시지 등. 제거되는 팔레트/Shipment 전용 키는 잔존해도 무방하나 신규 키는 4파일 동기화. 추가 검증은 `scripts/find_missing_i18n.js`.

## 9. 범위 밖 (별도 보고)

- **Shipment 생명주기 UI 이전**: 현재 confirm이 유일하게 가진 Shipment(팔레트 출하로 생성됨)의 SHIPPED→DELIVERED / 역분개 / ERP동기화 관리 UI가 제거된다. 박스출하는 Shipment를 생성하지 않으므로 무관. 이 관리 기능의 새 위치(history 등)는 본 작업에 포함하지 않고 별도 과제로 둔다.
- **candidateBoxes ↔ OQC_ENABLED 정합화**(백엔드).
- **BoxMaster.shipOrderNo 추가로 출하완료 박스 목록화**(추후 출하취소 UX 개선 시).

## 10. 검증

- `pnpm --filter @harness/frontend exec tsc --noEmit`(dev 서버 가동 중이면 빌드 대신 타입체크).
- i18n 4파일 키 동기화 Grep 검증.
- 수동 흐름: 지시 선택 → 후보 박스 표시 → 스캔/클릭 → 출하확정 → 잔여수량 감소·완출 시 지시 CLOSED → 출하취소로 복원.
