# Domain Workflows

## 목적

현재 코드 기준으로 도메인별 업무 흐름과 상태 전이를 정리한다.
기준 원본은 각 서비스의 상태값, 검증 로직, 트랜잭션 처리다.

## 1. 자재 흐름

### 기본 흐름

1. 입하 등록
2. LOT 생성 및 라벨 발행
3. IQC 판정
4. PASS LOT만 입고 가능
5. 입고 후 자재 재고 반영
6. 자재 출고, 실사, 조정, 폐기, 보류로 후속 분기

### 주요 엔티티

- `MatArrival`
- `MatLot`
- `IqcLog`
- `MatReceiving`
- `MatStock`
- `StockTransaction`

### 주요 상태와 규칙

- 입하 시 `MatArrival.status = DONE`
- 입하 직후 `iqcStatus = PENDING`
- IQC 판정 후 LOT는 `PASS` 또는 `FAIL`
- 입고는 `PASS` LOT만 허용
- 보류, 폐기, 실사, 재고조정은 입고 이후 흐름에서 추가로 갈라진다.

### 관련 서비스 축

- `arrival.service.ts`
- `iqc-history.service.ts`
- `receiving.service.ts`
- `mat-stock.service.ts`
- `mat-issue.service.ts`
- `physical-inv.service.ts`

## 2. 생산 흐름

### 기본 흐름

1. 생산계획 생성
2. 생산계획 확정
3. 작업지시 발행
4. 작업 시작
5. 자재, 작업자, 설비 투입
6. 생산실적 등록
7. 생산실적 완료
8. WIP 또는 FG 재고 반영

### 생산계획 상태

- `DRAFT`
- `CONFIRMED`
- `CLOSED`

### 작업지시 상태

- `WAITING`
- `RUNNING`
- `HOLD`
- `DONE`
- `CANCELED`

### 생산실적 상태

- `RUNNING`
- `DONE`
- `CANCELED`

### 규칙

- 확정된 계획만 작업지시를 발행할 수 있다.
- `WAITING` 상태의 작업지시만 시작 가능하다.
- 생산실적 완료 시 자동출고, 설비/금형 갱신, 제품재고 적재가 함께 수행된다.
- 생산실적 완료와 작업지시 완료는 현재 별도 액션이다.

### 관련 서비스 축

- `prod-plan.service.ts`
- `job-order.service.ts`
- `prod-result.service.ts`
- `auto-issue.service.ts`
- `simulation-data.service.ts`

## 3. 품질 흐름

### 검사 및 추적 흐름

1. 입고 또는 생산 이후 검사 수행
2. 검사결과 등록
3. 불합격이면 불량 또는 재작업 처리 연결
4. OQC로 출하 전 품질 차단
5. SPC와 MSA로 통계 관리
6. 추적성 조회는 `TraceLog` 우선, 없으면 `ProdResult + InspectResult` fallback

### 주요 하위 도메인

- `inspection`
- `defects`
- `oqc`
- `rework`
- `spc`
- `audit`
- `change-management`
- `fai`
- `ppap`
- `continuity-inspect`

### 주요 서비스 축

- `inspect-result.service.ts`
- `trace.service.ts`
- `defect-log.service.ts`
- `oqc.service.ts`
- `rework.service.ts`
- `spc.service.ts`
- `msa.service.ts`

## 4. 출하 흐름

### 기본 흐름

1. 고객주문 등록
2. 출하지시 등록 또는 확정
3. 박스 포장
4. 팔레트 적재
5. 출하 생성
6. `PREPARING -> LOADED -> SHIPPED -> DELIVERED`
7. 필요 시 반품 또는 출하 취소 처리

### 출하지시 상태

- `DRAFT`
- `CONFIRMED`

### 출하 상태

- `PREPARING`
- `LOADED`
- `SHIPPED`
- `DELIVERED`
- `CANCELED`

### 박스 및 팔레트 상태

- Box: `OPEN`, `CLOSED`, `SHIPPED`
- Pallet: `OPEN`, `CLOSED`, `LOADED`, `SHIPPED`

### 규칙

- `PREPARING` 상태에서만 박스와 팔레트 적재를 조정한다.
- `LOADED` 상태에서만 실제 출하 처리 가능하다.
- `SHIPPED` 상태에서만 배송완료 전이가 가능하다.
- OQC가 `FAIL` 또는 `PENDING`이면 출하를 차단한다.
- 출하 취소 시 상태와 FG 라벨, 제품 트랜잭션을 함께 복원한다.

### 관련 서비스 축

- `customer-order.service.ts`
- `ship-order.service.ts`
- `shipment.service.ts`
- `box.service.ts`
- `pallet.service.ts`
- `ship-history.service.ts`
- `ship-return.service.ts`

## 5. 추적성 흐름

### 입력 키

- FG 바코드
- 생산 UID
- 작업지시 번호
- LOT 또는 시리얼

### 조회 축

- Man: 작업자
- Machine: 설비
- Material: 자재 투입 이력
- Method: 검사 및 관리기준 정보

### 대표 연결 경로

- 자재: `PurchaseOrder -> Arrival -> IQC -> Receiving -> MatLot -> MatStock`
- 생산: `ProdPlan -> JobOrder -> ProdResult`
- 품질: `ProdResult -> InspectResult -> DefectLog / TraceLog`
- 출하: `ShipmentOrder -> Box -> Pallet -> Shipment`

## 6. 현재 주의사항

1. 자재 취소와 복원 흐름은 일부 구간에서 `itemCode` 중심 연결이 남아 있다.
2. `shipping/orders`와 `shipping/shipments`의 관계는 문서보다 코드 기준으로 다시 해석해야 한다.
3. 생산실적 완료와 작업지시 완료는 현재 완전히 동일한 이벤트가 아니다.

## 함께 읽을 문서

- [05-production-process-flow.md](C:/Project/HANES/docs/core/05-production-process-flow.md)
- [backend-module-index.md](C:/Project/HANES/docs/core/backend-module-index.md)
- [02-data-model-erd.md](C:/Project/HANES/docs/core/02-data-model-erd.md)
- [anti-patterns.md](C:/Project/HANES/docs/core/anti-patterns.md)
