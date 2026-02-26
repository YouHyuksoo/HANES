# UID 시스템 재설계: lotNo → matUid / prdUid / supUid 3원화

## 배경

현재 `lotNo` 단일 필드가 925곳(140파일)에서 자재·제품·공급상 LOT 구분 없이 사용 중.
이를 용도별 3종 UID로 분리하고, LOT 생성 시점도 입하→라벨발행으로 변경한다.

## 명명 규칙

| UID | DB 컬럼 | 한국어 명칭 | 용도 |
|-----|---------|------------|------|
| `matUid` | `MAT_UID` | 자재시리얼 | 자재 개별 단위 고유번호 (입고/출고/재고/추적성) |
| `prdUid` | `PRD_UID` | 제품시리얼 | 제품/반제품 개별 단위 고유번호 (제품재고/출하/추적성) |
| `supUid` | `SUP_UID` | 공급상시리얼 | 공급업체 부여 LOT/시리얼 (nullable, 추적 연결용) |

---

## Section 1: 테이블/Entity 구조

### 변경 대상 Entity 매핑

| Entity | 변경 내용 |
|--------|----------|
| `MatLot` | PK `lotNo` → `matUid` |
| `MatArrival` | `lotNo` 제거, `iqcStatus`/`supUid`(nullable)/`invoiceNo` 추가 |
| `MatReceiving` | `lotNo` → `matUid` |
| `MatIssue` | `lotNo` → `matUid` |
| `MatIssueRequest` | `lotNo` → `matUid` |
| `StockTransaction` | `lotNo` → `matUid`(nullable) + `prdUid`(nullable) 분리 |
| `ProdResult` | `lotNo` → `prdUid`(nullable, 라벨 발행 전 null) |
| `TraceLog` | `lotNo` → `matUid`/`prdUid` 분리 |
| `ConsumableLog` | `lotNo` → `matUid` |
| `ConsumableMountLog` | `lotNo` → `matUid` |
| `LabelPrintLog` | `lotIds` → `uidList`(CLOB, JSON), `category`: `mat_uid`/`prd_uid` |
| `IqcLog` | `lotNo` 제거 (IQC는 MatArrival 기준) |
| `OqcRequestBox` | `lotNo` → `prdUid` |
| `RepairLog` | `lotNo` → `prdUid` |
| `ShipmentOrderItem` | `lotNo` → `prdUid` |
| `SubconDelivery/Order/Receive` | `lotNo` → 용도별 `matUid` 또는 `prdUid` |

### MatArrival 신규 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `iqcStatus` | `VARCHAR2(20)` | IQC 상태 (PENDING/PASS/FAIL) |
| `supUid` | `VARCHAR2(50)` | 공급상시리얼 (nullable) |
| `invoiceNo` | `VARCHAR2(50)` | 인보이스번호 |

---

## Section 2: 데이터 플로우

### 자재 플로우
```
입하(MatArrival) → IQC검사 → 라벨발행(matUid 채번) → 입고 → 재고 → 출고
```

### 라벨발행 시점 (matUid)
```
IQC PASS 입하건 선택 → 수량만큼 matUid N개 채번(DB Function) → MatLot N건 INSERT (각 qty=1) → 라벨 인쇄
```

### 제품 플로우 (경로 A - 생산실적)
```
생산실적(ProdResult) → 제품라벨발행(prdUid 채번) → 제품재고
```

### 제품 플로우 (경로 B - 통전검사)
```
생산실적(ProdResult) → 통전검사(OQC) PASS → 제품라벨발행(prdUid 채번) → 제품재고
```

### 추적성 체인
```
prdUid → matUid → supUid
```

### matUid 특성
- 자재 1개 = matUid 1개 (1:1 관계)
- qty=100 입하 → 라벨 발행 시 matUid 100개 생성, 각 qty=1

### supUid 특성
- nullable (없을 수도 있음)
- 입하 시 입력 가능, 라벨 발행 시에도 입력 가능
- supUid:matUid = 혼합 (1:1, 1:N, null 모두 가능)

---

## Section 3: API 및 Backend 변경

### Entity 변경 방식
- 개발/테스트 데이터만 존재 → **DROP + 재생성**
- TypeORM `synchronize: true`로 테이블 자동 생성

### 채번 방식
- `F_GET_MAT_UID()` — Oracle DB Function 호출
- `F_GET_PRD_UID()` — Oracle DB Function 호출
- 기존 `NumRuleService` 채번은 폐기

### Service 변경

| Service | 변경 |
|---------|------|
| `ArrivalService` | LOT 생성 로직 **제거**, supUid/invoiceNo 저장만 |
| `ReceiveLabelService` (신규) | IQC PASS 입하건 조회 → matUid 채번 → MatLot INSERT → 라벨 인쇄 |
| `ProductLabelService` (신규) | 생산실적/OQC PASS 조회 → prdUid 채번 → 제품라벨 발행 |
| `ReceivingService` | lotNo → matUid 참조 변경 |
| `MatIssueService` | lotNo → matUid |
| `MatStockService` | lotNo → matUid |
| `ProdResultService` | lotNo → prdUid |
| 기타 전체 Service | UID 필드명 전환 |

---

## Section 4: Frontend 변경

### 자재 라벨 발행 페이지 (`/material/receive-label`)
- **현재**: IQC 합격 LOT 목록 → 선택 → 인쇄
- **변경**: IQC 합격 **입하건** 목록 → 선택 → 수량만큼 matUid 생성 + 인쇄

### 제품 라벨 발행 페이지
- 경로 A: 생산실적 미발행건 → 선택 → prdUid 채번 + 라벨 출력
- 경로 B: OQC PASS 건 → 선택 → prdUid 채번 + 라벨 출력

### 전체 lotNo 참조 변경 (~70+ 파일)
| 영역 | lotNo → |
|------|---------|
| 자재 관련 페이지 | `matUid` |
| 제품 관련 페이지 | `prdUid` |
| 추적성 페이지 | `matUid` + `prdUid` 분리 |

### i18n (ko/en/zh/vi)
- `LOT번호` → `자재시리얼` / `제품시리얼` / `공급상시리얼`

---

## Section 5: 구현 순서

| 단계 | 작업 | 범위 |
|------|------|------|
| Step 1 | DB Function 생성 (F_GET_MAT_UID, F_GET_PRD_UID) | Oracle DB |
| Step 2 | Entity 전면 수정 | ~25개 Entity |
| Step 3 | DB 테이블 DROP + 재생성 | 전체 테이블 |
| Step 4 | Backend Service/Controller/DTO 전환 | ~30개 파일 |
| Step 5 | Frontend 페이지 + 컴포넌트 전환 | ~70개 파일 |
| Step 6 | i18n 4개 언어 파일 수정 | ko/en/zh/vi |
| Step 7 | 자재 라벨 발행 페이지 재설계 | Backend + Frontend |
| Step 8 | 제품 라벨 발행 기능 구현 | Backend + Frontend |
| Step 9 | pnpm build 전체 빌드 검증 | Backend + Frontend |

## 검증 체크리스트

- [ ] 모든 Entity에서 lotNo 참조 0건 (Grep)
- [ ] Backend/Frontend 빌드 에러 0건
- [ ] 자재 라벨 발행: 입하건 → matUid 채번 → MatLot → 라벨 인쇄
- [ ] 제품 라벨 발행: 생산실적/OQC PASS → prdUid 채번 → 라벨 인쇄
- [ ] 재고/수불 페이지 matUid/prdUid 정상 표시
- [ ] 추적성 prdUid → matUid → supUid 체인
- [ ] i18n 4개 언어 누락 키 없음
