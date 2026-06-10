# Domain Workflows

## 목적

현재 코드 기준으로 도메인별 업무 흐름과 상태 전이를 정리한다.
기준 원본은 각 서비스의 상태값, 검증 로직, 트랜잭션 처리다.

---

## 1. 자재 흐름

### 기본 흐름

1. 입하 등록 (PO 기반 또는 수동)
2. 입하 라벨 발행 시 LOT 생성 (`MatLot`)
3. IQC 샘플검사 (입하번호+품목 단위)
4. IQC 합격 + 검사성적서 업로드 → 입고 가능
5. 입고 후 자재 재고 반영 (`MatStock`)
6. 출고요청 → 승인 → 출고처리
7. 분할/병합, 실사, 조정, 보류 등 후속 처리

### 주요 엔티티

- `MatArrival` — 입하 이력 (복합 PK: arrivalNo + seq)
- `MatLot` — LOT/시리얼 (PK: matUid)
- `IqcLog` — IQC 검사 이력 (복합 PK: inspectDate + seq)
- `MatReceiving` — 입고 이력 (복합 PK: receiveNo + seq)
- `MatStock` — 자재 재고 현황 (복합 PK: company, plant, warehouseCode, itemCode, matUid)
- `StockTransaction` — 수불원장 (PK: transNo)
- `MatIssueRequest` / `MatIssueRequestItem` — 출고요청 헤더/품목
- `MatIssue` — 실제 출고 이력 (복합 PK: issueNo + seq)

### 주요 상태와 규칙

#### 입하 (`MatArrival`)
- `status = DONE` (고정)
- `iqcStatus = PENDING` (기본값, IQC 미실시 상태)
- `arrivalType`: `PO` (발주연동) 또는 `MANUAL` (수동등록)
- `supUid`: 입하 라벨 발행 시 LOT에 연결되는 자재시리얼

#### LOT (`MatLot`)
- `iqcStatus`: `PENDING` → `PASS` 또는 `FAIL`
- `status`: `NORMAL` (정상), `HOLD` (보류), `DEPLETED` (소진), `SPLIT` (분할완료), `MERGED` (병합완료)
- `initQty`: 입고 시 발행 원수량 (불변)
- `currentQty`: 현재 잔량 (수불에 따라 감소)

#### IQC 검사 (`IqcLog`)
- **검사 단위**: 입하번호(`arrivalNo`) + 품목(`itemCode`) 단위 샘플검사
- `matUid`는 nullable — 개별 시리얼 검사가 아닌 입하 단위 검사
- `inspectType`: `INITIAL` (초기검사), `RETEST` (재검사)
- `result`: `PASS` (합격), `FAIL` (불합격)
- `inspectClass`: `FULL` (전수), `SAMPLE` (선별), `NONE` (무검사)
- `status`: `DONE` (완료), `CANCELED` (취소)
- IQC 취소 시: 입고 완료(`MatReceiving.status=DONE`)된 건은 취소 불가
- `iqcYn=Y`인 품목은 **검사성적서 업로드 필수** (`certFilePath`)

#### 입고 (`MatReceiving`)
- `status = DONE` (고정)
- 입고 가능 조건:
  1. `MatLot.iqcStatus = PASS`
  2. `MatLot.status IN (NORMAL, HOLD)`
  3. `iqcYn=Y` 품목 → 검사성적서 업로드 완료
- 입고 시 `MatReceiving` + `StockTransaction(RECEIVE)` 동시 생성
- `MatStock` 재고 증가

#### 출고요청 (`MatIssueRequest`)
- 상태 흐름: `REQUESTED` → `APPROVED` → `COMPLETED`
- 또는 `REQUESTED` → `REJECTED`
- `APPROVED` 상태만 실제 출고 처리 가능
- `issueType`: `PRODUCTION` (양산), `DEFECT` (불량), `SAMPLE` (샘플), `SCRAP` (폐기), `RETURN` (반품) 등
- 작업지시 선택 시 BOM 기반 자동 요청품목 생성 가능

#### 출고처리 (`MatIssue`)
- `status = DONE` (고정)
- `issueType`: 출고요청의 타입 상속 또는 별도 지정
- 출고 가능 조건:
  1. `MatLot.iqcStatus = PASS`
  2. `MatLot.status != HOLD`
  3. `MatStock.availableQty >= issueQty`
- 출고 시 `MatIssue` + `StockTransaction(MAT_OUT)` 동시 생성
- `MatStock` 재고 감소, 전량 소진 시 `MatLot.status = DEPLETED`

#### 자재분할/병합
- **분할**: 원본 LOT `status = SPLIT` → 신규 2개 LOT 발번
- **병합**: 원본 LOT(들) `status = MERGED` → 통합 1개 LOT 발번
- 분할/병합 대상: 입고 완료된 LOT만 가능
- 파생 LOT는 `origin` 필드로 계보 추적

### 관련 서비스 축

- `arrival.service.ts`
- `iqc-history.service.ts`
- `receiving.service.ts`
- `mat-stock.service.ts`
- `issue-request.service.ts`
- `mat-issue.service.ts`
- `lot-split.service.ts`
- `lot-merge.service.ts`
- `physical-inv.service.ts`
- `adjustment.service.ts`

---

## 2. 생산 흐름

### 기본 흐름

1. 생산계획 생성
2. 생산계획 확정
3. 작업지시 발행
4. 작업 시작 (입력키오스크 — 작업자설비점검, 소모품 수명 확인)
5. 자재 투입 (바코드 스캔)
6. 생산실적 등록 (양품/불량)
7. 생산실적 완료
8. FG 라벨 발행 및 완제품 재고 반영

### 생산계획 상태

- `DRAFT`
- `CONFIRMED`
- `CLOSED`

### 작업지시 상태

- `WAITING` (대기)
- `RUNNING` (진행중)
- `HOLD` (보류)
- `DONE` (완료)
- `CANCELED` (취소)

### 생산실적 상태

- `RUNNING`
- `DONE`
- `CANCELED`

### 규칙

- 확정된 계획(`CONFIRMED`)만 작업지시를 발행할 수 있다.
- `WAITING` 상태의 작업지시만 시작 가능하다.
- `HOLD` 상태의 작업지시는 보류해제 후 진행 가능하다.
- 생산실적 완료 시 자동출고, 설비/금형 갱신, 제품재고 적재가 함께 수행된다.
- 생산실적 완료와 작업지시 완료는 별도 액션이다.
- `DONE` 또는 `CANCELED` 상태의 작업지시는 수정/시작 불가.

### 입력키오스크 흐름

1. 작업지시 선택
2. 설비 선택 (설비일일점검 완료 확인)
3. 작업자설비점검 (QR 스캔 또는 체크리스트)
4. 소모품 수명 확인
5. 자재 투입 (LOT 바코드 스캔)
6. 생산실적 등록

### 관련 서비스 축

- `prod-plan.service.ts`
- `job-order.service.ts`
- `prod-result.service.ts`
- `auto-issue.service.ts`
- `input-kiosk.service.ts`

---

## 3. 품질 흐름

### 검사 및 추적 흐름

1. 입고 또는 생산 이후 검사 수행
2. 검사결과 등록
3. 불합격이면 불량 또는 재작업 처리 연결
4. OQC로 출하 전 품질 차단
5. SPC와 MSA로 통계 관리
6. 추적성 조회는 `TraceLog` 우선, 없으면 `ProdResult + InspectResult` fallback

### IQC (수입검사)

- **검사 단위**: 입하번호 + 품목 (샘플검사)
- **검사 유형**: `INITIAL` (초기), `RETEST` (재검사)
- **결과**: `PASS` (합격), `FAIL` (불합격)
- **검사분류**: `FULL` (전수), `SAMPLE` (선별), `NONE` (무검사)
- **파괴검사**: `destructSampleQty` 시료 수량만큼 자동 출고 처리
- **취소 제약**: 입고 완료된 건은 IQC 취소 불가

### OQC (출하검사)

- 출하 전 박스/팔레트 단위 검사
- `PENDING` 상태 박스만 OQC 대상
- `PASS` 시 박스 `CLOSED` 상태로 전환
- `FAIL` 시 출하 차단

### 주요 하위 도메인

- `inspection` — 검사결과 관리
- `defects` — 불량 이력
- `oqc` — 출하전 품질 검사
- `rework` — 재작업 관리
- `spc` — 통계적 공정관리
- `audit` — 품질 감사
- `change-management` — 변경관리 (CAPA, 불만, 변경지시)
- `fai` — FAI (First Article Inspection)
- `ppap` — PPAP
- `continuity-inspect` — 도통검사

### 관련 서비스 축

- `iqc-history.service.ts`
- `inspect-result.service.ts`
- `trace.service.ts`
- `defect-log.service.ts`
- `oqc.service.ts`
- `rework.service.ts`
- `spc.service.ts`
- `msa.service.ts`

---

## 4. 출하 흐름

### 기본 흐름

1. 고객주문 등록
2. 출하지시 등록 또는 확정
3. 박스 포장 (시리얼 스캔)
4. OQC 검사
5. 박스 상태 `CLOSED`로 전환
6. 팔레트 적재
7. 출하 생성
8. `PREPARING → LOADED → SHIPPED → DELIVERED`
9. 필요 시 반품 또는 출하 취소 처리

### 출하지시 상태

- `DRAFT`
- `CONFIRMED`

### 출하 상태

- `PREPARING` (준비중)
- `LOADED` (적재완료)
- `SHIPPED` (출하완료)
- `DELIVERED` (배송완료)
- `CANCELED` (취소)

### 박스 상태

- `PENDING` (대기)
- `VISUAL_PASS` (외관검사 합격)
- `CLOSED` (박스마감)
- `SHIPPED` (출하완료)

### 팔레트 상태

- `OPEN` (열림)
- `CLOSED` (마감)
- `LOADED` (적재)
- `SHIPPED` (출하완료)

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

---

## 5. 추적성 흐름

### 입력 키

- FG 바코드
- 생산 UID (`prdUid`)
- 작업지시 번호
- LOT 또는 시리얼 (`matUid`)

### 조회 축 (4M)

- **Man**: 작업자
- **Machine**: 설비
- **Material**: 자재 투입 이력 (`MatIssue`)
- **Method**: 검사 및 관리기준 정보

### 대표 연결 경로

- **자재**: `PurchaseOrder → MatArrival → IQC → MatReceiving → MatLot → MatStock → MatIssue`
- **생산**: `ProdPlan → JobOrder → ProdResult → FgLabel`
- **품질**: `ProdResult → InspectResult → DefectLog / TraceLog`
- **출하**: `CustomerOrder → ShipOrder → Box → Pallet → Shipment`

---

## 6. 현재 주의사항

1. **IQC 검사 단위**: 개별 시리얼 전수검사가 아닌 입하번호+품목 단위 샘플검사로 변경됨 (`IqcLog.matUid` nullable).
2. **LOT 생성 타이밍**: 입하 등록 시점이 아닌 **라벨 발행 시** LOT가 생성됨 (`MatArrival.supUid`는 라벨 발행 전 null).
3. **출고 워크플로우**: `MatIssueRequest` (승인/반려) → `MatIssue` (실제 출고) 2단계로 분리됨.
4. **자재분할/병합**: `SPLIT`/`MERGED` 상태 추가. 입고 완료된 LOT만 분할/병합 가능.
5. **생산 흐름**: 입력키오스크에서 작업자설비점검 및 소모품 수명 확인이 작업 시작 전 필수 단계.
6. **취소 정책**: 입하 취소는 뒤 공정(출고, 생산실적, 출하 등)이 없는 경우만 가능. 역처리 금지.

---

## 함께 읽을 문서

- [05-production-process-flow.md](05-production-process-flow.md)
- [backend-module-index.md](../design/backend-module-index.md)
- [02-data-model-erd.md](../design/02-data-model-erd.md)
- [db-schema-erd.md](../reports/db-schema-erd.md)
- [anti-patterns.md](../standards/anti-patterns.md)
