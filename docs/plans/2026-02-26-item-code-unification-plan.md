# 품목코드 통일 및 UUID 제거 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 전체 시스템의 품목코드를 `itemCode`로 통일하고, 모든 UUID PK를 자연키/SEQUENCE로 전환한다.

**Architecture:** TypeORM Entity-First 방식. Entity를 먼저 수정하고, TypeScript 컴파일 에러를 따라가며 DTO → Service → Controller → Frontend를 순차 수정한다. 마지막에 SQL DDL 스크립트를 생성하여 Oracle DB를 재생성한다.

**Tech Stack:** NestJS, TypeORM (Oracle), Next.js, pnpm monorepo

**Design Doc:** `docs/plans/2026-02-26-item-code-unification-design.md`

---

## 변경 패턴 정의 (모든 Task에서 참조)

### 패턴 A: 마스터 엔티티 - UUID PK → 자연키 PK

```typescript
// BEFORE
@PrimaryGeneratedColumn('uuid', { name: 'ID' })
id: string;

@Column({ name: 'SOME_CODE', length: 50, unique: true })
someCode: string;

// AFTER - id 필드 제거, someCode를 PK로 승격
@PrimaryColumn({ name: 'SOME_CODE', length: 50 })
someCode: string;
```

### 패턴 B: 트랜잭션 엔티티 - UUID PK → SEQUENCE PK

```typescript
// BEFORE
@PrimaryGeneratedColumn('uuid', { name: 'ID' })
id: string;

// AFTER
@PrimaryGeneratedColumn({ name: 'ID' })
id: number;
```

### 패턴 C: 복합 PK 엔티티

```typescript
// BEFORE
@PrimaryGeneratedColumn('uuid', { name: 'ID' })
id: string;

// AFTER - id 제거, 복합 PK 적용
@PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 20 })
warehouseCode: string;

@PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
itemCode: string;

@PrimaryColumn({ name: 'LOT_NO', length: 50 })
lotNo: string;
```

### 패턴 D: partId 참조 → itemCode 참조

```typescript
// BEFORE
@Column({ name: 'PART_ID', nullable: true })
partId: string;

// AFTER
@Column({ name: 'ITEM_CODE', length: 50, nullable: true })
itemCode: string;
```

### 패턴 E: DTO에서 partId → itemCode

```typescript
// BEFORE
@IsOptional()
@IsString()
partId?: string;

// AFTER
@IsOptional()
@IsString()
itemCode?: string;
```

### 패턴 F: Service에서 partId → itemCode

```typescript
// BEFORE
.where('t.partId = :partId', { partId })
// AFTER
.where('t.itemCode = :itemCode', { itemCode })
```

---

## Phase 1: Backend Entity 수정

### Task 1: PartMaster → ItemMaster 핵심 엔티티 변환

**Files:**
- Modify: `apps/backend/src/entities/part-master.entity.ts`

**Step 1: PartMaster 엔티티 변환**

- 파일명은 유지 (part-master.entity.ts) 또는 item-master.entity.ts로 변경
- 클래스명: `PartMaster` 유지 (import 변경 최소화) 또는 `ItemMaster`로 변경
- 테이블명: `PART_MASTERS` → `ITEM_MASTERS`
- PK: `id` (UUID) 제거 → `itemCode` (string) PK로 승격
- 필드 리네이밍:
  - `partCode` → `itemCode` (PK)
  - `partName` → `itemName`
  - `partNo` → `itemNo` (있으면)
  - `partType` → `itemType`
- 나머지 컬럼 유지 (spec, unit, productType 등)

**Step 2: 빌드 에러 확인**

Run: `cd apps/backend && npx tsc --noEmit 2>&1 | head -50`
Expected: partId/partCode 참조하는 모든 파일에서 에러 발생

**Step 3: 커밋**

```bash
git add apps/backend/src/entities/part-master.entity.ts
git commit -m "refactor: PartMaster UUID→itemCode 자연키 PK 전환"
```

---

### Task 2: 원자재 도메인 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/mat-stock.entity.ts` — 패턴 C (복합PK) + 패턴 D
- Modify: `apps/backend/src/entities/mat-lot.entity.ts` — 패턴 A (lotNo PK) + 패턴 D
- Modify: `apps/backend/src/entities/mat-receiving.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D
- Modify: `apps/backend/src/entities/stock-transaction.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D
- Modify: `apps/backend/src/entities/mat-issue.entity.ts` — 패턴 B (SEQUENCE)
- Modify: `apps/backend/src/entities/mat-issue-request.entity.ts` — 패턴 B (SEQUENCE)
- Modify: `apps/backend/src/entities/mat-issue-request-item.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D
- Modify: `apps/backend/src/entities/mat-arrival.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D
- Modify: `apps/backend/src/entities/inv-adj-log.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D

**Step 1: 각 엔티티 수정**

MatStock 변경:
- `id` (UUID PK) 제거
- `@Unique(['warehouseCode', 'partId', 'lotId'])` 제거
- 복합 PK: `(warehouseCode, itemCode, lotNo)` — `@PrimaryColumn` 3개
- `partId` → `itemCode` (패턴 D)
- `lotId` 참조도 lotNo로 변경 검토

MatLot 변경:
- `id` (UUID PK) 제거 → `lotNo` (string PK, 패턴 A)
- `partId` → `itemCode` (패턴 D)

MatReceiving 변경:
- `id` (UUID) → `id` (number, SEQUENCE, 패턴 B)
- `partId` → `itemCode` (패턴 D)

StockTransaction 변경:
- `id` (UUID) → `id` (number, SEQUENCE, 패턴 B)
- `partId` → `itemCode` (패턴 D)
- `lotId` → `lotNo` 검토

나머지 엔티티도 동일 패턴 적용.

**Step 2: 커밋**

```bash
git add apps/backend/src/entities/mat-*.entity.ts apps/backend/src/entities/stock-transaction.entity.ts apps/backend/src/entities/inv-adj-log.entity.ts
git commit -m "refactor: 원자재 도메인 엔티티 UUID→자연키/SEQUENCE 전환"
```

---

### Task 3: 제품 도메인 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/product-stock.entity.ts` — 패턴 C (복합PK) + 패턴 D
- Modify: `apps/backend/src/entities/product-transaction.entity.ts` — 패턴 B (SEQUENCE) + 패턴 D

**Step 1: 각 엔티티 수정**

ProductStock 변경:
- `id` (UUID PK) 제거
- 복합 PK: `(warehouseCode, itemCode, lotNo)`
- `partId` → `itemCode`, `partType` → `itemType`

ProductTransaction 변경:
- `id` (UUID) → `id` (number, SEQUENCE)
- `partId` → `itemCode`, `partType` → `itemType`
- `jobOrderId` → `orderNo` (JobOrder 자연키 참조)

**Step 2: 커밋**

```bash
git add apps/backend/src/entities/product-*.entity.ts
git commit -m "refactor: 제품 도메인 엔티티 UUID→자연키/SEQUENCE 전환"
```

---

### Task 4: 생산 도메인 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/job-order.entity.ts` — 패턴 A (orderNo PK) + 패턴 D
- Modify: `apps/backend/src/entities/prod-result.entity.ts` — 패턴 B (SEQUENCE)
- Modify: `apps/backend/src/entities/inspect-result.entity.ts` — 패턴 B (SEQUENCE)
- Modify: `apps/backend/src/entities/defect-log.entity.ts` — 패턴 B (SEQUENCE)
- Modify: `apps/backend/src/entities/bom-master.entity.ts` — 패턴 C (복합PK)
- Modify: `apps/backend/src/entities/process-map.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/sample-inspect-result.entity.ts` — 패턴 B

**Step 1: 각 엔티티 수정**

JobOrder 변경:
- `id` (UUID PK) 제거 → `orderNo` (string PK)
- `partId` → `itemCode` (패턴 D)
- `@ManyToOne(() => PartMaster)` 관계 업데이트 (JoinColumn: ITEM_CODE)
- `parentId` → `parentOrderNo` (self-reference)

ProdResult 변경:
- `id` (UUID) → `id` (number, SEQUENCE)
- `jobOrderId` → `orderNo` (JobOrder 자연키 참조)
- `equipId` → `equipCode` (EquipMaster 자연키 참조)
- `workerId` → workerCode 검토

BomMaster 변경:
- `id` (UUID PK) 제거
- 복합 PK: `(parentItemCode, childItemCode, revision)`
- `parentPartId` → `parentItemCode`
- `childPartId` → `childItemCode`

**Step 2: 커밋**

```bash
git add apps/backend/src/entities/job-order.entity.ts apps/backend/src/entities/prod-result.entity.ts apps/backend/src/entities/inspect-result.entity.ts apps/backend/src/entities/defect-log.entity.ts apps/backend/src/entities/bom-master.entity.ts apps/backend/src/entities/process-map.entity.ts apps/backend/src/entities/sample-inspect-result.entity.ts
git commit -m "refactor: 생산 도메인 엔티티 UUID→자연키/SEQUENCE 전환"
```

---

### Task 5: 품질/검사 도메인 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/iqc-log.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/iqc-item-master.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/iqc-part-link.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/iqc-item-pool.entity.ts` — 패턴 B + **충돌 해결**
- Modify: `apps/backend/src/entities/iqc-group.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/iqc-group-item.entity.ts` — 패턴 B + **충돌 해결**
- Modify: `apps/backend/src/entities/oqc-request.entity.ts` — 패턴 A (requestNo PK) + 패턴 D
- Modify: `apps/backend/src/entities/oqc-request-box.entity.ts` — 패턴 B

**Step 1: IQC 충돌 해결**

IqcItemPool: `itemCode` → `inspItemCode`, `itemName` → `inspItemName`
IqcGroupItem: `itemId` → `inspItemId`

**Step 2: partId → itemCode 변환**

IqcLog, IqcItemMaster, IqcPartLink: `partId` → `itemCode`
OqcRequest: `partId` → `itemCode`, PK를 `requestNo`로

**Step 3: 커밋**

```bash
git add apps/backend/src/entities/iqc-*.entity.ts apps/backend/src/entities/oqc-*.entity.ts
git commit -m "refactor: 품질/검사 도메인 엔티티 UUID→자연키/SEQUENCE, IQC 충돌 해결"
```

---

### Task 6: 영업/구매/출하 도메인 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/purchase-order.entity.ts` — 패턴 A (poNo PK)
- Modify: `apps/backend/src/entities/purchase-order-item.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/customer-order.entity.ts` — 패턴 A (orderNo PK)
- Modify: `apps/backend/src/entities/customer-order-item.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/shipment-order.entity.ts` — 패턴 A (shipOrderNo PK)
- Modify: `apps/backend/src/entities/shipment-order-item.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/shipment-return.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/shipment-return-item.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/shipment-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/box-master.entity.ts` — 패턴 A (boxNo PK) + 패턴 D
- Modify: `apps/backend/src/entities/pallet-master.entity.ts` — 패턴 A
- Modify: `apps/backend/src/entities/subcon-order.entity.ts` — 패턴 A (orderNo PK)
- Modify: `apps/backend/src/entities/subcon-delivery.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/subcon-receive.entity.ts` — 패턴 B

**Step 1: 각 엔티티 수정 (패턴 A/B/D 적용)**

PurchaseOrderItem, CustomerOrderItem, ShipmentOrderItem, ShipmentReturnItem: `partId` → `itemCode`
BoxMaster: `partId` → `itemCode`, PK를 `boxNo`로
마스터성 엔티티: UUID → 자연키 PK
이력/트랜잭션: UUID → SEQUENCE

**Step 2: 커밋**

```bash
git add apps/backend/src/entities/purchase-*.entity.ts apps/backend/src/entities/customer-*.entity.ts apps/backend/src/entities/shipment-*.entity.ts apps/backend/src/entities/box-master.entity.ts apps/backend/src/entities/pallet-master.entity.ts apps/backend/src/entities/subcon-*.entity.ts
git commit -m "refactor: 영업/구매/출하 도메인 엔티티 UUID→자연키/SEQUENCE 전환"
```

---

### Task 7: 기타 마스터 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/process-master.entity.ts` — 패턴 A (processCode PK)
- Modify: `apps/backend/src/entities/prod-line-master.entity.ts` — 패턴 A (lineCode PK)
- Modify: `apps/backend/src/entities/equip-master.entity.ts` — 패턴 A (equipCode PK)
- Modify: `apps/backend/src/entities/warehouse.entity.ts` — 패턴 A (warehouseCode PK)
- Modify: `apps/backend/src/entities/warehouse-location.entity.ts` — 패턴 B or A
- Modify: `apps/backend/src/entities/consumable-master.entity.ts` — 패턴 A (consumableCode PK)
- Modify: `apps/backend/src/entities/worker-master.entity.ts` — 패턴 A (자연키 확인 필요)
- Modify: `apps/backend/src/entities/partner-master.entity.ts` — 패턴 A (자연키 확인 필요)
- Modify: `apps/backend/src/entities/department-master.entity.ts` — 패턴 A (자연키 확인 필요)
- Modify: `apps/backend/src/entities/vendor-barcode-mapping.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/work-instruction.entity.ts` — 패턴 B + 패턴 D
- Modify: `apps/backend/src/entities/model-suffix.entity.ts` — 패턴 B or A
- Modify: `apps/backend/src/entities/num-rule-master.entity.ts` — 패턴 A

**Step 1: 각 마스터를 자연키 PK로 전환**

모든 마스터 엔티티에서 `id` (UUID) 제거, 기존 unique 컬럼을 `@PrimaryColumn`으로 승격.
자연키가 명확하지 않은 엔티티는 소스 확인 후 결정.

**Step 2: 커밋**

```bash
git add apps/backend/src/entities/process-master.entity.ts apps/backend/src/entities/prod-line-master.entity.ts apps/backend/src/entities/equip-master.entity.ts apps/backend/src/entities/warehouse*.entity.ts apps/backend/src/entities/consumable-master.entity.ts apps/backend/src/entities/worker-master.entity.ts apps/backend/src/entities/partner-master.entity.ts apps/backend/src/entities/department-master.entity.ts apps/backend/src/entities/vendor-barcode-mapping.entity.ts apps/backend/src/entities/work-instruction.entity.ts apps/backend/src/entities/model-suffix.entity.ts apps/backend/src/entities/num-rule-master.entity.ts
git commit -m "refactor: 기타 마스터 엔티티 UUID→자연키 PK 전환"
```

---

### Task 8: 시스템/설비/기타 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/user.entity.ts` — 패턴 A (email PK)
- Modify: `apps/backend/src/entities/user-auth.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/role.entity.ts` — 패턴 A (code PK)
- Modify: `apps/backend/src/entities/role-menu-permission.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/com-code.entity.ts` — 패턴 C (groupCode, detailCode)
- Modify: `apps/backend/src/entities/comm-config.entity.ts` — 패턴 A or B
- Modify: `apps/backend/src/entities/sys-config.entity.ts` — 패턴 A or B
- Modify: `apps/backend/src/entities/plant.entity.ts` — 패턴 C (복합PK)
- Modify: `apps/backend/src/entities/company-master.entity.ts` — 패턴 C (복합PK)
- Modify: `apps/backend/src/entities/equip-bom-item.entity.ts` — 패턴 A + **충돌 해결**
- Modify: `apps/backend/src/entities/equip-bom-rel.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/equip-inspect-item-master.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/equip-inspect-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/pm-plan.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/pm-plan-item.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/pm-work-order.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/pm-wo-result.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/label-template.entity.ts` — 패턴 A or B
- Modify: `apps/backend/src/entities/label-print-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/activity-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/trace-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/inter-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/consumable-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/consumable-mount-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/repair-log.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/customs-entry.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/customs-lot.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/customs-usage-report.entity.ts` — 패턴 B
- Modify: `apps/backend/src/entities/warehouse-transfer-rule.entity.ts` — 패턴 B

**Step 1: EquipBomItem 충돌 해결**

`itemCode` → `bomItemCode`, `itemName` → `bomItemName`

**Step 2: 시스템 엔티티 자연키/SEQUENCE 전환**

ComCode: 복합PK `(groupCode, detailCode)`
Plant: 복합PK `(plantCode, shopCode, lineCode, cellCode)`
User: `email` PK
Role: `code` PK
나머지 이력/로그: SEQUENCE

**Step 3: 커밋**

```bash
git add apps/backend/src/entities/
git commit -m "refactor: 시스템/설비/기타 엔티티 UUID→자연키/SEQUENCE 전환"
```

---

## Phase 2: Backend DTO + Service + Controller 수정

### Task 9: DTO 전체 수정

**Files:** `apps/backend/src/modules/**/dto/*.dto.ts` (75개 중 partId/partCode 참조하는 23개+)

**주요 변경 대상:**
- `apps/backend/src/modules/master/dto/part.dto.ts` — partCode→itemCode, partName→itemName
- `apps/backend/src/modules/master/dto/bom.dto.ts` — parentPartId→parentItemCode, childPartId→childItemCode
- `apps/backend/src/modules/material/dto/mat-stock.dto.ts` — partId→itemCode
- `apps/backend/src/modules/material/dto/mat-lot.dto.ts` — partId→itemCode
- `apps/backend/src/modules/material/dto/receiving.dto.ts` — partId→itemCode
- `apps/backend/src/modules/inventory/dto/inventory.dto.ts` — partId→itemCode
- `apps/backend/src/modules/inventory/dto/product-inventory.dto.ts` — partId→itemCode
- `apps/backend/src/modules/production/dto/job-order.dto.ts` — partId→itemCode
- `apps/backend/src/modules/production/dto/prod-result.dto.ts` — partId→itemCode
- `apps/backend/src/modules/shipping/dto/ship-order.dto.ts` — partId→itemCode
- `apps/backend/src/modules/shipping/dto/box.dto.ts` — partId→itemCode
- `apps/backend/src/modules/quality/dto/oqc.dto.ts` — partId→itemCode
- `apps/backend/src/modules/interface/dto/interface.dto.ts` — partId→itemCode
- `apps/backend/src/modules/master/dto/iqc-item-pool.dto.ts` — itemCode→inspItemCode (충돌 해결)
- 기타 모든 partId/partCode/partName 참조 DTO

**Step 1: 모든 DTO에서 패턴 E 적용**

- `partId` → `itemCode` (타입 동일: string)
- `partCode` → `itemCode`
- `partName` → `itemName`
- `partType` → `itemType`
- `parentPartId` → `parentItemCode`
- `childPartId` → `childItemCode`
- `jobOrderId` → `orderNo` (JobOrder 자연키)

**Step 2: Grep 검증**

Run: `grep -r "partId\|partCode\|partName\|partType" apps/backend/src/modules/**/dto/ --include="*.ts" -l`
Expected: 0 results

**Step 3: 커밋**

```bash
git add apps/backend/src/modules/**/dto/
git commit -m "refactor: 전체 DTO partId→itemCode 전환"
```

---

### Task 10: Material 모듈 Service 수정

**Files:**
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`
- Modify: `apps/backend/src/modules/material/services/mat-stock.service.ts`
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts`
- Modify: `apps/backend/src/modules/material/services/issue-request.service.ts`
- Modify: `apps/backend/src/modules/material/services/lot-split.service.ts`
- Modify: `apps/backend/src/modules/material/services/lot-merge.service.ts`
- Modify: `apps/backend/src/modules/material/services/physical-inv.service.ts`
- Modify: `apps/backend/src/modules/material/services/shelf-life.service.ts`
- Modify: `apps/backend/src/modules/material/services/scrap.service.ts`
- Modify: `apps/backend/src/modules/material/services/mat-lot.service.ts`
- Modify: `apps/backend/src/modules/material/services/receipt-cancel.service.ts`
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
- Modify: `apps/backend/src/modules/material/services/hold.service.ts`
- Modify: `apps/backend/src/modules/material/services/adjustment.service.ts`
- Modify: `apps/backend/src/modules/material/services/misc-receipt.service.ts`
- Modify: `apps/backend/src/modules/material/services/po-status.service.ts`
- Modify: `apps/backend/src/modules/material/services/purchase-order.service.ts`
- Modify: `apps/backend/src/modules/material/services/label-print.service.ts`

**Step 1: 패턴 F 적용**

- 모든 `partId` 변수/파라미터 → `itemCode`
- 모든 `partCode` 변수 → `itemCode`
- 쿼리빌더: `.where('t.partId = :partId', { partId })` → `.where('t.itemCode = :itemCode', { itemCode })`
- Repository: `{ partId }` → `{ itemCode }`
- UUID 기반 `findOne({ where: { id } })` → 자연키 기반 `findOne({ where: { lotNo } })` 등

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/material/services/
git commit -m "refactor: Material 모듈 서비스 partId→itemCode 전환"
```

---

### Task 11: Inventory 모듈 Service 수정

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/inventory.service.ts` (47회 참조)
- Modify: `apps/backend/src/modules/inventory/services/product-inventory.service.ts` (13회 참조)
- Modify: `apps/backend/src/modules/inventory/services/product-physical-inv.service.ts` (11회 참조)
- Modify: `apps/backend/src/modules/inventory/services/product-hold.service.ts` (9회 참조)
- Modify: `apps/backend/src/modules/inventory/services/warehouse-location.service.ts`
- Modify: `apps/backend/src/modules/inventory/services/warehouse.service.ts`

**Step 1: 패턴 F 적용 (inventory.service.ts 집중 — 47회 참조로 가장 많음)**

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/inventory/services/
git commit -m "refactor: Inventory 모듈 서비스 partId→itemCode 전환"
```

---

### Task 12: Production 모듈 Service 수정

**Files:**
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts`
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts`
- Modify: `apps/backend/src/modules/production/services/sample-inspect.service.ts`
- Modify: `apps/backend/src/modules/production/services/production-views.service.ts`

**Step 1: 패턴 F 적용**

- `jobOrderId` 참조 → `orderNo` 참조 (JobOrder 자연키)
- `partId` → `itemCode`
- `equipId` → `equipCode`

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/
git commit -m "refactor: Production 모듈 서비스 partId→itemCode 전환"
```

---

### Task 13: Shipping/Quality/Master/기타 모듈 Service 수정

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/ship-return.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/ship-history.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/customer-order.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/pallet.service.ts`
- Modify: `apps/backend/src/modules/shipping/services/box.service.ts`
- Modify: `apps/backend/src/modules/quality/services/oqc.service.ts`
- Modify: `apps/backend/src/modules/quality/services/inspect-result.service.ts`
- Modify: `apps/backend/src/modules/master/services/part.service.ts`
- Modify: `apps/backend/src/modules/master/services/bom.service.ts`
- Modify: `apps/backend/src/modules/master/services/routing.service.ts`
- Modify: `apps/backend/src/modules/master/services/work-instruction.service.ts`
- Modify: `apps/backend/src/modules/master/services/vendor-barcode-mapping.service.ts`
- Modify: `apps/backend/src/modules/master/services/iqc-item-pool.service.ts` (충돌 해결)
- Modify: `apps/backend/src/modules/interface/services/interface.service.ts`
- Modify: `apps/backend/src/modules/customs/services/customs.service.ts`
- Modify: `apps/backend/src/modules/outsourcing/services/outsourcing.service.ts`
- Modify: `apps/backend/src/modules/dashboard/services/dashboard.service.ts`

**Step 1: 패턴 F 적용**

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/shipping/ apps/backend/src/modules/quality/ apps/backend/src/modules/master/ apps/backend/src/modules/interface/ apps/backend/src/modules/customs/ apps/backend/src/modules/outsourcing/ apps/backend/src/modules/dashboard/
git commit -m "refactor: Shipping/Quality/Master/기타 모듈 서비스 partId→itemCode 전환"
```

---

### Task 14: Controller 수정

**Files:**
- Modify: `apps/backend/src/modules/master/controllers/part.controller.ts`
- Modify: `apps/backend/src/modules/inventory/inventory.controller.ts`
- 기타 partId를 파라미터로 받는 컨트롤러

**Step 1: 라우트 파라미터, 쿼리 파라미터에서 partId → itemCode**

**Step 2: 커밋**

```bash
git add apps/backend/src/modules/**/controllers/ apps/backend/src/modules/**/*.controller.ts
git commit -m "refactor: Controller partId→itemCode 전환"
```

---

### Task 15: Backend 빌드 검증

**Step 1: 잔여 partId/partCode 참조 확인**

Run: `grep -r "partId\|partCode\|partName\|partType" apps/backend/src/ --include="*.ts" -l`
Expected: 0 results (또는 주석/문자열만 남아있어야 함)

**Step 2: TypeScript 컴파일 확인**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: 에러 0개

**Step 3: 커밋 (에러 수정분)**

```bash
git add apps/backend/
git commit -m "fix: Backend 빌드 에러 수정"
```

---

## Phase 3: Frontend 수정

### Task 16: Frontend Material/Inventory 페이지 수정

**Files (partId/partCode 참조하는 모든 Material/Inventory 페이지 및 컴포넌트):**
- `apps/frontend/src/app/(authenticated)/material/*/page.tsx` (전체)
- `apps/frontend/src/app/(authenticated)/material/*/components/*.tsx`
- `apps/frontend/src/app/(authenticated)/inventory/*/page.tsx` (전체)
- `apps/frontend/src/app/(authenticated)/inventory/*/components/*.tsx`
- `apps/frontend/src/app/(authenticated)/material/stock/page.tsx`

**Step 1: 모든 partId → itemCode, partCode → itemCode 치환**

- API 호출 파라미터
- DataGrid 컬럼 `field: 'partId'` → `field: 'itemCode'`
- 검색 필터 변수명
- 응답 데이터 참조

**Step 2: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/material/ apps/frontend/src/app/\(authenticated\)/inventory/
git commit -m "refactor: Frontend Material/Inventory 페이지 partId→itemCode 전환"
```

---

### Task 17: Frontend Production/Quality/Shipping/Master 페이지 수정

**Files:**
- `apps/frontend/src/app/(authenticated)/production/*/page.tsx`
- `apps/frontend/src/app/(authenticated)/production/*/components/*.tsx`
- `apps/frontend/src/app/(authenticated)/quality/*/page.tsx`
- `apps/frontend/src/app/(authenticated)/shipping/*/page.tsx`
- `apps/frontend/src/app/(authenticated)/master/part/page.tsx`
- `apps/frontend/src/app/(authenticated)/master/bom/page.tsx`
- `apps/frontend/src/app/(authenticated)/product/*/page.tsx`

**Step 1: 모든 partId → itemCode, partCode → itemCode 치환**

**Step 2: 커밋**

```bash
git add apps/frontend/src/app/\(authenticated\)/production/ apps/frontend/src/app/\(authenticated\)/quality/ apps/frontend/src/app/\(authenticated\)/shipping/ apps/frontend/src/app/\(authenticated\)/master/ apps/frontend/src/app/\(authenticated\)/product/
git commit -m "refactor: Frontend Production/Quality/Shipping/Master 페이지 partId→itemCode 전환"
```

---

### Task 18: Frontend PDA/공통 컴포넌트/훅 수정

**Files:**
- `apps/frontend/src/app/(authenticated)/pda/*/page.tsx` (있으면)
- `apps/frontend/src/components/**/*.tsx` (partId/partCode 참조하는 것)
- `apps/frontend/src/hooks/**/*.ts` (partId/partCode 참조하는 것)
- `apps/frontend/src/utils/**/*.ts` (partId/partCode 참조하는 것)
- `apps/frontend/src/config/menuConfig.ts` (있으면)

**Step 1: partId → itemCode 전환**

**Step 2: 커밋**

```bash
git add apps/frontend/src/components/ apps/frontend/src/hooks/ apps/frontend/src/utils/ apps/frontend/src/config/
git commit -m "refactor: Frontend 공통 컴포넌트/훅 partId→itemCode 전환"
```

---

### Task 19: i18n 파일 수정

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

**Step 1: partId/partCode/partName 관련 키 변경**

- `"partCode"` → `"itemCode"` (키와 값 모두)
- `"partName"` → `"itemName"`
- `"partType"` → `"itemType"`
- 한국어 라벨: "품번" → "품목코드", "품명" → "품목명"
- 영어/중국어/베트남어도 동일 수정

**Step 2: Grep 검증**

Run: `grep -r "partCode\|partId\|partName\|partType" apps/frontend/src/locales/ -l`
Expected: 0 results

**Step 3: 커밋**

```bash
git add apps/frontend/src/locales/
git commit -m "refactor: i18n 파일 partId→itemCode 전환 (ko, en, zh, vi)"
```

---

### Task 20: Frontend 빌드 검증

**Step 1: 잔여 참조 확인**

Run: `grep -r "partId\|partCode\|partName\|partType" apps/frontend/src/ --include="*.ts" --include="*.tsx" -l`
Expected: 0 results

**Step 2: Frontend 빌드 확인**

Run: `cd apps/frontend && npx next build`
Expected: 에러 0개

**Step 3: 커밋 (에러 수정분)**

```bash
git add apps/frontend/
git commit -m "fix: Frontend 빌드 에러 수정"
```

---

## Phase 4: SQL DDL 및 최종 검증

### Task 21: Oracle SQL DDL 스크립트 생성

**Files:**
- Create: `scripts/migration/001_drop_all_tables.sql`
- Create: `scripts/migration/002_create_sequences.sql`
- Create: `scripts/migration/003_create_master_tables.sql`
- Create: `scripts/migration/004_create_transaction_tables.sql`
- Create: `scripts/migration/005_create_indexes.sql`

**Step 1: DROP 스크립트**

모든 기존 테이블 DROP (FK 관계 고려하여 역순)

**Step 2: SEQUENCE 생성 스크립트**

트랜잭션/이력 테이블용 Oracle SEQUENCE 생성:
```sql
CREATE SEQUENCE SEQ_STOCK_TRANSACTION START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE SEQ_PRODUCT_TRANSACTION START WITH 1 INCREMENT BY 1;
-- ... 각 트랜잭션 테이블별
```

**Step 3: CREATE TABLE 스크립트**

Entity 정의에 맞춰 DDL 생성. TypeORM Entity를 기반으로 정확한 컬럼 타입/길이/제약조건 반영.

**Step 4: INDEX 스크립트**

검색 성능을 위한 인덱스 생성.

**Step 5: 커밋**

```bash
git add scripts/migration/
git commit -m "feat: UUID→자연키/SEQUENCE 전환 Oracle DDL 마이그레이션 스크립트"
```

---

### Task 22: 전체 빌드 및 최종 검증

**Step 1: Monorepo 전체 빌드**

Run: `pnpm build`
Expected: Backend + Frontend 모두 성공

**Step 2: 잔여 UUID/partId 참조 최종 확인**

Run: `grep -r "partId\|partCode\|partName\|partType" apps/ --include="*.ts" --include="*.tsx" -l`
Expected: 0 results

Run: `grep -r "PrimaryGeneratedColumn.*uuid" apps/backend/src/entities/ --include="*.ts" -l`
Expected: 0 results

**Step 3: 최종 커밋**

```bash
git add .
git commit -m "refactor: 품목코드 통일 및 UUID 제거 완료"
```

---

## 작업 요약

| Phase | Tasks | 예상 파일 수 |
|---|---|---|
| Phase 1: Entity | Task 1~8 | 87개 엔티티 |
| Phase 2: DTO/Service/Controller | Task 9~15 | 75 DTO + 74 Service + Controller |
| Phase 3: Frontend | Task 16~20 | 126+ 페이지/컴포넌트 + 4 i18n |
| Phase 4: SQL/검증 | Task 21~22 | SQL 스크립트 + 빌드 검증 |
| **합계** | **22 Tasks** | **366+ 파일** |
