# HARNESS MES 컬럼 도메인 사전

> **목적**: 모든 테이블에서 동일한 의미의 컬럼은 동일한 이름·타입·규칙을 사용하여 일관성을 유지한다.
> **적용 범위**: Prisma 스키마(schema.prisma)의 모든 모델
> **최종 갱신**: 2026-02-15

---

## 1. 도메인 정의 요약

| # | 도메인 | 표준 접미사 | Prisma 타입 | DB 타입 | 예시 |
|---|--------|-----------|------------|---------|------|
| D01 | 식별자 (PK) | `id` | `String` | `cuid()` | `id` |
| D02 | 코드 | `xxxCode` | `String` | `varchar` | `partCode`, `processCode` |
| D03 | 번호 (채번) | `xxxNo` | `String` | `varchar` | `orderNo`, `lotNo`, `shipNo` |
| D04 | 이름 | `xxxName` | `String` | `varchar` | `partName`, `equipName` |
| D05 | 상태 | `status` | `String` | `varchar` | `status` (ComCode 참조) |
| D06 | 판정 결과 | `result` | `String` | `varchar` | `result` (PASS / FAIL) |
| D07 | 수량 | `xxxQty` | `Int` 또는 `Decimal` | `integer` / `decimal` | `planQty`, `goodQty` |
| D08 | 금액 / 단가 | `unitPrice`, `totalAmount` | `Decimal` | `decimal(12,4)` / `decimal(14,2)` | `unitPrice`, `totalAmount` |
| D09 | 날짜 (일자만) | `xxxDate` | `DateTime` | `@db.Date` | `orderDate`, `dueDate` |
| D10 | 시각 (타임스탬프) | `xxxAt` | `DateTime` | `@db.Timestamptz(6)` | `createdAt`, `startAt` |
| D11 | 비고 | `remark` | `String?` | `text` | `remark` (항상 단수) |
| D12 | 사용여부 | `useYn` | `String` | `varchar(1)` | `useYn` (Y / N) |
| D13 | YN 플래그 | `xxxYn` | `String` | `varchar(1)` | `erpSyncYn`, `iqcFlag` → `iqcYn` |
| D14 | Boolean 플래그 | `isXxx` | `Boolean` | `boolean` | `isDefault` (DB 기본값 전용) |
| D15 | 참조키 (FK) | `xxxId` | `String` | `varchar` | `partId`, `equipId` |
| D16 | 감사 컬럼 | 고정 3종 | `DateTime` | `@db.Timestamptz(6)` | `createdAt`, `updatedAt`, `deletedAt` |
| D17 | 작성자 / 승인자 | `xxxBy` | `String?` | `varchar` | `createdBy`, `approvedBy` |
| D18 | 정렬순서 | `sortOrder` | `Int` | `integer` | `sortOrder` |
| D19 | URL | `xxxUrl` | `String?` | `text` | `imageUrl`, `photoUrl` |
| D20 | JSON 확장 | 업무별 자유 | `Json?` | `jsonb` | `inspectData`, `eventData` |

---

## 2. 도메인별 상세 규칙

### D01. 식별자 (PK)

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `id` (고정) |
| 타입 | `String @id @default(cuid())` |
| 비고 | 모든 모델에서 동일. UUID/auto-increment 사용 금지 |

---

### D02. 코드 (xxxCode)

**"사람이 부여하는 고유 식별 문자열"** — 설비코드, 품목코드, 공정코드 등

| 항목 | 규칙 |
|------|------|
| 명명 | `{엔티티명}Code` — `partCode`, `equipCode`, `processCode`, `warehouseCode` |
| 타입 | `String @unique` |
| 제약 | 테이블 내 유일, 변경 불가 원칙 |
| FK 참조 | 다른 테이블에서 코드를 FK로 사용하지 않음 → 반드시 `xxxId`로 참조 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `warehouseCode` (FK) | MatStock, InvAdjLog | 코드를 FK로 사용 | `warehouseId` (FK)로 변경 |
| `partCode` (FK) | SubconOrder, CustomsLot | 코드를 FK로 사용 | `partId` (FK)로 변경 |
| `oper` | BomMaster | 공정코드인데 다른 이름 | `processCode`로 통일 |

---

### D03. 번호 (xxxNo)

**"시스템이 채번하는 일련번호"** — 작업지시번호, LOT번호, 출하번호 등

| 항목 | 규칙 |
|------|------|
| 명명 | `{엔티티명}No` — `orderNo`, `lotNo`, `shipNo`, `boxNo`, `palletNo` |
| 타입 | `String @unique` |
| 패턴 | 채번규칙 테이블(NumRuleMaster)에 의해 자동 생성 |
| 참고 | `xxxCode`(사람 부여) vs `xxxNo`(시스템 채번) 구분 필수 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `partNo` | PartMaster | 품번인데 `xxxNo` 패턴과 혼동 | 그대로 유지 (Oracle 품번, 의미 다름) |
| `custPartNo` | PartMaster | 고객품번 | 그대로 유지 |

---

### D04. 이름 (xxxName)

**"사람이 읽는 표시 이름"**

| 항목 | 규칙 |
|------|------|
| 명명 | `{엔티티명}Name` — `partName`, `equipName`, `workerName`, `processName` |
| 타입 | `String` |
| 비고 | 외래 데이터 비정규 저장 시에도 동일 패턴 (예: `customerName`, `vendorName`) |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `name` | ConsumableMaster | 접두사 없음 | `consumableName`으로 변경 |
| `name` | User | 접두사 없음 | 그대로 유지 (User는 범용 모델) |
| `configName` | CommConfig | 패턴 일관성 | 그대로 유지 |

---

### D05. 상태 (status)

**"해당 레코드의 현재 상태를 나타내는 ComCode 참조 값"**

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `status` (고정, 한 모델에 하나만) |
| 타입 | `String @default("초기값")` |
| 값 | ComCode의 `groupCode`에 등록된 코드 사용 |
| 예시 | `WAITING`, `RUNNING`, `DONE`, `CANCELED` |

> 보조 상태가 필요한 경우: `{도메인}Status` 패턴 사용 (예: `iqcStatus`)

---

### D06. 판정 결과 (result)

**"합격/불합격 등 판정 값"**

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `result` 또는 `{도메인}Result` |
| 타입 | `String` |
| 허용값 | `PASS`, `FAIL`, `CONDITIONAL`, `PARTIAL` |
| 비고 | `Y`/`N` 포맷 사용 금지 → PASS/FAIL 사용 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `passYn` (Y/N) | InspectResult | Y/N 형태 판정 | `result` (PASS/FAIL)로 변경 |
| `result` (PASS/FAIL) | RepairLog, IqcLog | 표준 준수 | 유지 |
| `overallResult` | EquipInspectLog | 다른 명칭 | 그대로 유지 (종합판정 의미 명확) |
| `inspectResult` | SubconReceive | 표준 준수 | 유지 |

---

### D07. 수량 (xxxQty)

| 항목 | 규칙 |
|------|------|
| 명명 | `{의미}Qty` |
| 타입 | `Int` (정수) 또는 `Decimal(10,4)` (소요량 등 소수) |
| 기본값 | `@default(0)` |

**표준 수량 컬럼명:**

| 컬럼명 | 의미 | 사용 모델 |
|--------|------|----------|
| `planQty` | 계획 수량 | JobOrder |
| `orderQty` | 발주/지시 수량 | SubconOrder, ShipmentOrderItem, CustomerOrderItem |
| `goodQty` | 양품 수량 | JobOrder, ProdResult, SubconReceive |
| `defectQty` | 불량 수량 | JobOrder, ProdResult, SubconOrder, SubconReceive |
| `receivedQty` | 입고 수량 | SubconOrder, PurchaseOrderItem |
| `shippedQty` | 출하 수량 | ShipmentOrderItem, CustomerOrderItem |
| `returnQty` | 반품 수량 | ShipmentReturnItem |
| `qty` | 현재/트랜잭션 수량 | Stock, StockTransaction, ConsumableLog |
| `initQty` | 초기 수량 | Lot, MatLot |
| `currentQty` | 현재 잔량 | Lot, MatLot |
| `reservedQty` | 예약 수량 | Stock, MatStock |
| `availableQty` | 가용 수량 | Stock, MatStock |
| `stockQty` | 현재고 수량 | ConsumableMaster |
| `safetyStock` | 안전재고 | PartMaster, ConsumableMaster |
| `boxQty` | 박스 입수량 | PartMaster |
| `usageQty` | 사용 수량 | CustomsUsageReport |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `recvQty` | SubconResult | 약어 불일치 | `receivedQty`로 변경 |
| `issueQty` | MatIssue | 패턴 일관성 | 그대로 유지 (출고수량 의미 명확) |
| `usedQty` | CustomsLot | `usageQty`와 혼용 | `usedQty`로 통일 (과거분사형) |
| `deliveredQty` | SubconOrder | 표준 준수 | 유지 |
| `lotUnitQty` | PartMaster | 약어 아닌 전체 사용 | 유지 |
| `qtyPer` | BomMaster | 특수: 단위소요량 | 유지 (BOM 전용 표현) |

---

### D08. 금액 / 단가

| 컬럼명 | 의미 | 타입 |
|--------|------|------|
| `unitPrice` | 단가 | `Decimal @db.Decimal(12, 4)` |
| `totalAmount` | 합계 금액 | `Decimal @db.Decimal(14, 2)` |
| `currency` | 통화 | `String @default("KRW")` |

---

### D09. 날짜 — 일자만 (xxxDate)

**"시간 정보 없이 날짜만 저장"** — 계획일, 납기일, 발주일 등

| 항목 | 규칙 |
|------|------|
| 명명 | `{의미}Date` |
| 타입 | `DateTime @db.Date` |
| 주의 | 시간 정보가 필요하면 `xxxAt` 사용 |

**표준 날짜 컬럼명:**

| 컬럼명 | 의미 |
|--------|------|
| `planDate` | 계획일 |
| `orderDate` | 발주일/수주일 |
| `dueDate` | 납기일 |
| `shipDate` | 출하(예정)일 |
| `recvDate` | 입고일 |
| `returnDate` | 반품일 |
| `inspectDate` | 점검/검사일 |
| `installDate` | 설치일 |
| `expireDate` | 유효기한 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `receiveDate` | SubconReceive | Timestamptz인데 Date 접미사 | `receivedAt` (시각)으로 변경 |
| `declarationDate` | CustomsEntry | 표준 준수 | 유지 |
| `clearanceDate` | CustomsEntry | 표준 준수 | 유지 |

---

### D10. 시각 — 타임스탬프 (xxxAt)

**"날짜 + 시간 + 시간대 포함"** — 시작시각, 종료시각, 생성시각 등

| 항목 | 규칙 |
|------|------|
| 명명 | `{의미}At` |
| 타입 | `DateTime @db.Timestamptz(6)` |
| 주의 | `xxxTime` 접미사 사용 금지 → `xxxAt`으로 통일 |

**표준 시각 컬럼명:**

| 컬럼명 | 의미 |
|--------|------|
| `startAt` | 시작 시각 |
| `endAt` | 종료 시각 |
| `createdAt` | 생성 시각 |
| `updatedAt` | 수정 시각 |
| `deletedAt` | 삭제(소프트) 시각 |
| `inspectAt` | 검사 시각 |
| `closeAt` | 마감/완료 시각 |
| `lastTransAt` | 최근 수불 시각 |
| `lastCountAt` | 최근 실사 시각 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `startTime` | JobOrder, ProdResult | `Time` 접미사 | `startAt`으로 변경 |
| `endTime` | JobOrder, ProdResult | `Time` 접미사 | `endAt`으로 변경 |
| `inspectTime` | InspectResult | `Time` 접미사 | `inspectAt`으로 변경 |
| `occurTime` | DefectLog | `Time` 접미사 | `occurAt`으로 변경 |
| `closeTime` | BoxMaster, PalletMaster | `Time` 접미사 | `closeAt`으로 변경 |
| `traceTime` | TraceLog | `Time` 접미사 | `traceAt`으로 변경 |
| `shipTime` | ShipmentLog | `Time` 접미사 | `shipAt`으로 변경 |
| `sendTime` | InterLog | `Time` 접미사 | `sendAt`으로 변경 |
| `recvTime` | InterLog | `Time` 접미사 | `recvAt`으로 변경 |
| `deliveryDate` | SubconDelivery | Timestamptz인데 Date 접미사 | `deliveredAt`으로 변경 |
| `lastReplace` | ConsumableMaster | 접미사 없음 | `lastReplaceAt`으로 변경 |
| `nextReplace` | ConsumableMaster | 접미사 없음 | `nextReplaceAt`으로 변경 |
| `lastCount` | MatStock | 접미사 없음 | `lastCountAt`으로 변경 |
| `lastLogin` | User | 접미사 없음 | `lastLoginAt`으로 변경 |
| `lastReset` | NumRuleMaster | Date인데 접미사 없음 | `lastResetDate`으로 변경 |

---

### D11. 비고 (remark)

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `remark` (항상 **단수**) |
| 타입 | `String?` (nullable) |
| 비고 | `remarks`, `description`, `memo` 사용 금지 |

**현재 불일치:**

| 현재 | 위치 | 권장 |
|------|------|------|
| `remarks` | PartMaster | `remark`으로 변경 |
| `description` | CommConfig | 유지 (설명과 비고는 다른 의미) |
| `reason` | InvAdjLog | 유지 (조정 사유, 비고와 다름) |

---

### D12. 사용여부 (useYn)

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `useYn` (고정) |
| 타입 | `String @default("Y")` |
| 허용값 | `Y`, `N` |
| 비고 | 소프트 삭제(`deletedAt`)와 별도. 마스터 데이터 비활성화 용도 |

**현재 불일치:**

| 현재 | 위치 | 권장 |
|------|------|------|
| `allowYn` | WarehouseTransferRule | 의미상 허용/차단이므로 유지 가능 (또는 `useYn`으로 통일) |

---

### D13. YN 플래그 (xxxYn)

**"Y/N 이분 판단이 필요한 속성"**

| 항목 | 규칙 |
|------|------|
| 명명 | `{의미}Yn` |
| 타입 | `String @default("Y" 또는 "N")` |
| 예시 | `erpSyncYn`, `iqcYn` |

**현재 불일치:**

| 현재 | 위치 | 권장 |
|------|------|------|
| `iqcFlag` | PartMaster | `iqcYn`으로 변경 |
| `passYn` | InspectResult | D06 판정 도메인으로 이동 → `result` |

---

### D14. Boolean 플래그 (isXxx)

| 항목 | 규칙 |
|------|------|
| 명명 | `is{속성}` |
| 타입 | `Boolean @default(false)` |
| 사용 제한 | **DB 기능 플래그 전용** (기본값 여부 등) |
| 비고 | 비즈니스 로직은 `xxxYn` 사용 권장 |

**적용 예시:** `isDefault` (Warehouse, LabelTemplate), `isShelfLife` (IqcItemMaster)

---

### D15. 참조키 — FK (xxxId)

| 항목 | 규칙 |
|------|------|
| 명명 | `{참조모델명}Id` — `partId`, `equipId`, `workerId`, `warehouseId` |
| 타입 | `String` 또는 `String?` (nullable) |
| 참조 대상 | 항상 대상 테이블의 `id` (PK) |
| 금지 | `xxxCode`를 FK로 사용하지 않음 |

**현재 불일치 및 권장 조치:**

| 현재 | 위치 | 문제 | 권장 |
|------|------|------|------|
| `warehouseCode` | MatStock | 코드를 FK로 사용 | `warehouseId`로 변경 + relation 추가 |
| `warehouseCode` | InvAdjLog | 코드를 FK로 사용 | `warehouseId`로 변경 + relation 추가 |
| `partCode` | SubconOrder | 코드를 FK로 사용 | `partId`로 변경 + relation 추가 |
| `partCode` | CustomsLot | 코드를 FK로 사용 | `partId`로 변경 + relation 추가 |
| `lineCode` | JobOrder, Warehouse 등 | String 참조 (FK 아님) | 점진적으로 `lineId` + relation 전환 검토 |
| `processCode` | ProdResult, TraceLog 등 | String 참조 (FK 아님) | 점진적으로 `processId` + relation 전환 검토 |
| `equipmentId` | ConsumableLog | `equipId`와 다른 이름 | `equipId`로 변경 |

---

### D16. 감사 컬럼 (Audit)

**모든 모델에 필수 포함 (3종 세트)**

```prisma
createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)
```

| 항목 | 규칙 |
|------|------|
| `createdAt` | 필수. 자동 설정 (`@default(now())`) |
| `updatedAt` | 필수. 자동 갱신 (`@updatedAt`) |
| `deletedAt` | 선택. 소프트 삭제 지원 시 nullable로 추가 |
| 이력(Log) 테이블 | `createdAt`만 필수, `updatedAt`/`deletedAt` 불필요 |

---

### D17. 작성자 / 승인자 (xxxBy)

| 항목 | 규칙 |
|------|------|
| 명명 | `{행위}By` — `createdBy`, `approvedBy`, `updatedBy` |
| 타입 | `String?` |
| 비고 | 현재 InvAdjLog, LabelTemplate에서만 사용. 향후 필요 시 확장 |

---

### D18. 정렬순서 (sortOrder)

| 항목 | 규칙 |
|------|------|
| 컬럼명 | `sortOrder` (고정) |
| 타입 | `Int @default(0)` |
| 별명 금지 | `seq`는 BOM/공정라우팅 등 순서 자체가 비즈니스 의미를 가질 때만 사용 |

---

## 3. 모델 구조 불일치 사항

### 3-1. 거래처 모델 중복

| 모델 | 용도 | 컬럼 구조 |
|------|------|----------|
| `PartnerMaster` | 공급사/고객사 통합 | `partnerCode`, `partnerType` (SUPPLIER, CUSTOMER) |
| `VendorMaster` | 외주처/공급사 | `vendorCode`, `vendorType` (SUBCON, SUPPLIER) |

**권장**: `VendorMaster`를 `PartnerMaster`로 통합하고 `partnerType`에 `SUBCON` 추가.
외주 모듈(SubconOrder 등)의 `vendorId`를 `partnerId`로 전환.

### 3-2. 레거시 모델 정리

| 레거시 모델 | 신규 대체 모델 | 상태 |
|-----------|-------------|------|
| `MatLot` | `Lot` | 마이그레이션 예정 |
| `MatStock` | `Stock` | 마이그레이션 예정 |
| `MatIssue` | `StockTransaction` | 마이그레이션 예정 |
| `InvAdjLog` | `StockTransaction` | 마이그레이션 예정 |

---

## 4. 전체 불일치 우선순위 요약

### P1 — 높음 (데이터 정합성 영향)

| # | 현재 | 위치 | 표준 | 이유 |
|---|------|------|------|------|
| 1 | `warehouseCode` (FK) | MatStock, InvAdjLog | `warehouseId` | FK는 id 참조 원칙 |
| 2 | `partCode` (FK) | SubconOrder, CustomsLot | `partId` | FK는 id 참조 원칙 |
| 3 | `passYn` (Y/N) | InspectResult | `result` (PASS/FAIL) | 판정 도메인 통일 |
| 4 | VendorMaster 중복 | 스키마 전체 | PartnerMaster 통합 | 거래처 일원화 |

### P2 — 중간 (명명 일관성)

| # | 현재 | 위치 | 표준 | 이유 |
|---|------|------|------|------|
| 5 | `recvQty` | SubconResult | `receivedQty` | 수량 약어 통일 |
| 6 | `iqcFlag` | PartMaster | `iqcYn` | YN 플래그 패턴 |
| 7 | `remarks` | PartMaster | `remark` | 단수 통일 |
| 8 | `oper` | BomMaster | `processCode` | 코드 도메인 |
| 9 | `name` | ConsumableMaster | `consumableName` | 이름 도메인 |
| 10 | `equipmentId` | ConsumableLog | `equipId` | FK 도메인 |

### P3 — 낮음 (점진적 개선)

| # | 현재 | 위치 | 표준 | 이유 |
|---|------|------|------|------|
| 11 | `startTime` → `startAt` | JobOrder, ProdResult | `xxxAt` | 시각 도메인 |
| 12 | `endTime` → `endAt` | JobOrder, ProdResult | `xxxAt` | 시각 도메인 |
| 13 | `inspectTime` → `inspectAt` | InspectResult | `xxxAt` | 시각 도메인 |
| 14 | `closeTime` → `closeAt` | BoxMaster, PalletMaster | `xxxAt` | 시각 도메인 |
| 15 | `occurTime` → `occurAt` | DefectLog | `xxxAt` | 시각 도메인 |
| 16 | `traceTime` → `traceAt` | TraceLog | `xxxAt` | 시각 도메인 |
| 17 | `shipTime` → `shipAt` | ShipmentLog | `xxxAt` | 시각 도메인 |
| 18 | `sendTime` → `sendAt` | InterLog | `xxxAt` | 시각 도메인 |
| 19 | `recvTime` → `recvAt` | InterLog | `xxxAt` | 시각 도메인 |
| 20 | `lastReplace` → `lastReplaceAt` | ConsumableMaster | `xxxAt` | 시각 도메인 |
| 21 | `lastLogin` → `lastLoginAt` | User | `xxxAt` | 시각 도메인 |
| 22 | `lineCode` → `lineId` | 다수 모델 | FK 정규화 | 점진적 전환 |

---

## 5. 신규 테이블/컬럼 추가 시 체크리스트

새 모델 또는 컬럼을 추가할 때 아래를 확인:

- [ ] PK는 `id String @id @default(cuid())`인가?
- [ ] 코드 컬럼은 `xxxCode` 패턴인가?
- [ ] 채번 번호는 `xxxNo` 패턴인가?
- [ ] 이름 컬럼은 `xxxName` 패턴인가?
- [ ] 상태 컬럼은 `status`이고 ComCode에 등록했는가?
- [ ] 수량 컬럼은 `xxxQty` 패턴이고 `@default(0)`인가?
- [ ] 날짜만 필요한 컬럼은 `xxxDate @db.Date`인가?
- [ ] 시각이 필요한 컬럼은 `xxxAt @db.Timestamptz(6)`인가? (`xxxTime` 금지)
- [ ] 비고 컬럼은 `remark` (단수)인가?
- [ ] FK는 `xxxId`이고 대상의 `id`를 참조하는가? (코드 참조 금지)
- [ ] 감사 3종 세트 (`createdAt`, `updatedAt`, `deletedAt`)를 포함했는가?
- [ ] YN 플래그는 `xxxYn` 패턴인가? (`xxxFlag` 금지)
- [ ] `@map("snake_case")`로 DB 컬럼명을 지정했는가?
- [ ] `@@map("table_name")`으로 테이블명을 지정했는가?
