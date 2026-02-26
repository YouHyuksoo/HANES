# UID 시스템 재설계 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `lotNo` 단일 필드를 `matUid`(자재시리얼) / `prdUid`(제품시리얼) / `supUid`(공급상시리얼) 3종으로 분리하고, LOT 생성 시점을 입하→라벨발행으로 변경한다.

**Architecture:** 16개 Entity의 컬럼명 변경, 25+ Service/DTO/Controller 참조 전환, 70+ Frontend 파일 필드명 전환, 신규 ReceiveLabelService/ProductLabelService 구현. DB는 개발 데이터만 있으므로 DROP+재생성(TypeORM synchronize). 채번은 Oracle DB Function 호출.

**Tech Stack:** NestJS + TypeORM (Oracle), Next.js + React, i18n (ko/en/zh/vi)

**Design Doc:** `docs/plans/2026-02-27-uid-system-redesign-design.md`

---

## Task 1: Oracle DB Function 생성

**Files:**
- Create: `scripts/migration/create_uid_functions.sql`

**Step 1: DB Function SQL 작성**

```sql
-- F_GET_MAT_UID: 자재시리얼 채번 (예: M25022700001)
CREATE OR REPLACE FUNCTION F_GET_MAT_UID RETURN VARCHAR2 IS
  v_seq NUMBER;
  v_prefix VARCHAR2(10);
BEGIN
  v_prefix := 'M' || TO_CHAR(SYSDATE, 'YYMMDD');
  SELECT MAT_UID_SEQ.NEXTVAL INTO v_seq FROM DUAL;
  RETURN v_prefix || LPAD(v_seq, 5, '0');
END;
/

-- F_GET_PRD_UID: 제품시리얼 채번 (예: P25022700001)
CREATE OR REPLACE FUNCTION F_GET_PRD_UID RETURN VARCHAR2 IS
  v_seq NUMBER;
  v_prefix VARCHAR2(10);
BEGIN
  v_prefix := 'P' || TO_CHAR(SYSDATE, 'YYMMDD');
  SELECT PRD_UID_SEQ.NEXTVAL INTO v_seq FROM DUAL;
  RETURN v_prefix || LPAD(v_seq, 5, '0');
END;
/

-- 시퀀스 생성
CREATE SEQUENCE MAT_UID_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE PRD_UID_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
```

> **참고:** 실제 DB Function 로직은 오빠가 Oracle DB에 직접 생성할 예정. 위는 참고용 템플릿이며, 실제 채번 규칙은 DB Function 내부에서 관리.

**Step 2: Backend에서 DB Function 호출 헬퍼 생성**

**Create:** `apps/backend/src/shared/uid-generator.service.ts`

```typescript
/**
 * @file uid-generator.service.ts
 * @description Oracle DB Function을 호출하여 matUid/prdUid를 채번하는 서비스
 */
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class UidGeneratorService {
  constructor(private readonly dataSource: DataSource) {}

  /** 트랜잭션 내에서 matUid 채번 */
  async nextMatUid(qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query('SELECT F_GET_MAT_UID() AS uid FROM DUAL');
    return result[0].UID;
  }

  /** 트랜잭션 내에서 prdUid 채번 */
  async nextPrdUid(qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query('SELECT F_GET_PRD_UID() AS uid FROM DUAL');
    return result[0].UID;
  }
}
```

**Create:** `apps/backend/src/shared/shared.module.ts` (또는 기존 모듈에 추가)

```typescript
import { Module, Global } from '@nestjs/common';
import { UidGeneratorService } from './uid-generator.service';

@Global()
@Module({
  providers: [UidGeneratorService],
  exports: [UidGeneratorService],
})
export class SharedModule {}
```

**Step 3: AppModule에 SharedModule 등록**

**Modify:** `apps/backend/src/app.module.ts`
- `SharedModule`을 imports에 추가

**Step 4: Commit**

```bash
git add scripts/migration/create_uid_functions.sql apps/backend/src/shared/
git commit -m "feat: add UidGeneratorService for matUid/prdUid generation via Oracle DB Function"
```

---

## Task 2: Backend Entity 전면 수정 (자재 관련)

**Files:**
- Modify: `apps/backend/src/entities/mat-lot.entity.ts`
- Modify: `apps/backend/src/entities/mat-arrival.entity.ts`
- Modify: `apps/backend/src/entities/mat-receiving.entity.ts`
- Modify: `apps/backend/src/entities/mat-issue.entity.ts`
- Modify: `apps/backend/src/entities/mat-stock.entity.ts`
- Modify: `apps/backend/src/entities/stock-transaction.entity.ts`
- Modify: `apps/backend/src/entities/inv-adj-log.entity.ts`
- Modify: `apps/backend/src/entities/customs-lot.entity.ts`

**Step 1: mat-lot.entity.ts — PK 변경**

| Before | After |
|--------|-------|
| `@PrimaryColumn({ name: 'LOT_NO', length: 50 })` | `@PrimaryColumn({ name: 'MAT_UID', length: 50 })` |
| `lotNo: string;` | `matUid: string;` |

JSDoc도 `lotNo가 PK` → `matUid가 PK (자재시리얼)` 변경.

**Step 2: mat-arrival.entity.ts — lotNo 제거 + 신규 컬럼 추가**

| 변경 | 내용 |
|------|------|
| **제거** | `@Column({ name: 'LOT_NO', length: 50 })` + `lotNo: string;` |
| **제거** | `@Index(['lotNo'])` |
| **추가** | `@Column({ name: 'IQC_STATUS', length: 20, default: 'PENDING' })` `iqcStatus: string;` |
| **추가** | `@Column({ name: 'SUP_UID', length: 50, nullable: true })` `supUid: string \| null;` |
| **추가** | `@Column({ name: 'INVOICE_NO', length: 50, nullable: true })` `invoiceNo: string \| null;` |

**Step 3: mat-receiving.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 50 })` | `@Column({ name: 'MAT_UID', length: 50 })` |
| `lotNo: string;` | `matUid: string;` |
| `@Index(['lotNo'])` | `@Index(['matUid'])` |

**Step 4: mat-issue.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 50 })` | `@Column({ name: 'MAT_UID', length: 50 })` |
| `lotNo: string;` | `matUid: string;` |
| `@Index(['lotNo'])` | `@Index(['matUid'])` |

**Step 5: mat-stock.entity.ts — 복합 PK**

| Before | After |
|--------|-------|
| `@PrimaryColumn({ name: 'LOT_NO', length: 50 })` | `@PrimaryColumn({ name: 'MAT_UID', length: 50 })` |
| `lotNo: string;` | `matUid: string;` |

**Step 6: stock-transaction.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 50, nullable: true })` | `@Column({ name: 'MAT_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `matUid: string \| null;` |
| `@Index(['lotNo'])` | `@Index(['matUid'])` |

**Step 7: inv-adj-log.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 50, nullable: true })` | `@Column({ name: 'MAT_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `matUid: string \| null;` |

**Step 8: customs-lot.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 100 })` | `@Column({ name: 'MAT_UID', length: 100 })` |
| `lotNo: string;` | `matUid: string;` |
| `@Index(['lotNo'])` | `@Index(['matUid'])` |

**Step 9: Commit**

```bash
git commit -m "refactor: rename lotNo → matUid in material-related entities (8 files)"
```

---

## Task 3: Backend Entity 전면 수정 (제품/추적/기타)

**Files:**
- Modify: `apps/backend/src/entities/product-stock.entity.ts`
- Modify: `apps/backend/src/entities/product-transaction.entity.ts`
- Modify: `apps/backend/src/entities/prod-result.entity.ts`
- Modify: `apps/backend/src/entities/trace-log.entity.ts`
- Modify: `apps/backend/src/entities/iqc-log.entity.ts`
- Modify: `apps/backend/src/entities/subcon-delivery.entity.ts`
- Modify: `apps/backend/src/entities/subcon-receive.entity.ts`
- Modify: `apps/backend/src/entities/label-print-log.entity.ts`

**Step 1: product-stock.entity.ts — 복합 PK**

| Before | After |
|--------|-------|
| `@PrimaryColumn({ name: 'LOT_NO', length: 50 })` | `@PrimaryColumn({ name: 'PRD_UID', length: 50 })` |
| `lotNo: string;` | `prdUid: string;` |

**Step 2: product-transaction.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 50, nullable: true })` | `@Column({ name: 'PRD_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `prdUid: string \| null;` |
| `@Index(['lotNo'])` | `@Index(['prdUid'])` |

**Step 3: prod-result.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 255, nullable: true })` | `@Column({ name: 'PRD_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `prdUid: string \| null;` |

**Step 4: trace-log.entity.ts — matUid + prdUid 분리**

| 변경 | 내용 |
|------|------|
| **제거** | `@Column({ name: 'LOT_NO', length: 255, nullable: true })` + `lotNo` |
| **제거** | `@Index(['lotNo'])` |
| **추가** | `@Column({ name: 'MAT_UID', length: 50, nullable: true })` `matUid: string \| null;` |
| **추가** | `@Column({ name: 'PRD_UID', length: 50, nullable: true })` `prdUid: string \| null;` |
| **추가** | `@Index(['matUid'])`, `@Index(['prdUid'])` |

**Step 5: iqc-log.entity.ts — lotNo 제거**

| 변경 | 내용 |
|------|------|
| **제거** | `@Column({ name: 'LOT_NO', length: 100, nullable: true })` + `lotNo` |
| **제거** | `@Index(['lotNo'])` |
| **추가** (선택) | `@Column({ name: 'ARRIVAL_NO', length: 50, nullable: true })` `arrivalNo: string \| null;` |

> IQC는 이제 MatArrival 기준이므로 arrivalNo로 연결.

**Step 6: subcon-delivery.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 255, nullable: true })` | `@Column({ name: 'MAT_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `matUid: string \| null;` |

**Step 7: subcon-receive.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_NO', length: 255, nullable: true })` | `@Column({ name: 'MAT_UID', length: 50, nullable: true })` |
| `lotNo: string \| null;` | `matUid: string \| null;` |

**Step 8: label-print-log.entity.ts**

| Before | After |
|--------|-------|
| `@Column({ name: 'LOT_IDS', type: 'clob', nullable: true })` | `@Column({ name: 'UID_LIST', type: 'clob', nullable: true })` |
| `lotIds: string \| null;` | `uidList: string \| null;` |

> `category` 필드 값: 기존 `mat_lot` → `mat_uid`, 신규 `prd_uid`

**Step 9: Commit**

```bash
git commit -m "refactor: rename lotNo → prdUid/matUid in product/trace/other entities (8 files)"
```

---

## Task 4: Backend DTO 전면 수정

**Files:** 18개 DTO 파일 (전부 `apps/backend/src/modules/*/dto/`)

**패턴:** 각 DTO에서 `lotNo` → 용도에 따라 `matUid` 또는 `prdUid` 변경

### 자재(Material) DTO → `matUid`

| DTO 파일 | 변경 |
|----------|------|
| `material/dto/mat-lot.dto.ts` | `lotNo` → `matUid` (CreateMatLotDto, GetMatLotsDto) |
| `material/dto/receiving.dto.ts` | `lotNo` → `matUid`, `lotNos` → `matUids` |
| `material/dto/mat-issue.dto.ts` | `lotNo` → `matUid` |
| `material/dto/mat-stock.dto.ts` | `lotNo` → `matUid` |
| `material/dto/hold.dto.ts` | `lotNo` → `matUid` |
| `material/dto/scrap.dto.ts` | `lotNo` → `matUid` |
| `material/dto/arrival.dto.ts` | `lotNo` 제거, `supUid`/`invoiceNo` 추가 |
| `material/dto/issue-request.dto.ts` | `lotNo` → `matUid` |
| `material/dto/iqc-history.dto.ts` | `lotNo` → `arrivalNo` 또는 제거 |
| `material/dto/adjustment.dto.ts` | `lotNo` → `matUid` |
| `material/dto/misc-receipt.dto.ts` | `lotNo` → `matUid` |
| `material/dto/scan-issue.dto.ts` | `lotNo` → `matUid` |
| `material/dto/label-print.dto.ts` | `lotNos` → `matUids`, category 값 변경 |

### 제품/재고 DTO → `prdUid`

| DTO 파일 | 변경 |
|----------|------|
| `inventory/dto/inventory.dto.ts` | `lotNo` → 자재: `matUid`, 제품: `prdUid` |
| `inventory/dto/product-inventory.dto.ts` | `lotNo` → `prdUid` |
| `production/dto/prod-result.dto.ts` | `lotNo` → `prdUid` |
| `customs/dto/customs.dto.ts` | `lotNo` → `matUid` |
| `outsourcing/dto/outsourcing.dto.ts` | `lotNo` → `matUid` |

**Commit:**

```bash
git commit -m "refactor: rename lotNo → matUid/prdUid in all backend DTOs (18 files)"
```

---

## Task 5: Backend Service 수정 — Material 모듈 (Part 1)

**Files:** (가장 변경량이 많은 핵심 서비스들)
- `material/services/arrival.service.ts` — LOT 생성 로직 제거 + supUid/invoiceNo 추가
- `material/services/receiving.service.ts` — lotNo → matUid (56개소)
- `material/services/mat-stock.service.ts` — lotNo → matUid (33개소)
- `material/services/mat-issue.service.ts` — lotNo → matUid (32개소)

### arrival.service.ts 특수 변경

1. **`createPoArrival()` 메서드 (175-199줄):**
   - MatLot 생성 코드 블록 **전체 제거**
   - MatArrival에 `supUid`, `invoiceNo`, `iqcStatus: 'PENDING'` 저장
   - `lotNo` 참조 제거

2. **`createManualArrival()` 메서드 (286-305줄):**
   - MatLot 생성 코드 블록 **전체 제거**
   - MatArrival에 `supUid`, `invoiceNo`, `iqcStatus: 'PENDING'` 저장
   - `lotNo` 참조 제거

3. **NumRuleService의 `nextNumberInTx(qr, 'LOT')` 호출 제거**

### 나머지 서비스: 기계적 치환

| 서비스 | 패턴 |
|--------|------|
| `receiving.service.ts` | `lotNo` → `matUid`, `lot_no` → `mat_uid` (SQL), `lotNos` → `matUids`, `lotIds` → `uidList` |
| `mat-stock.service.ts` | `lotNo` → `matUid` |
| `mat-issue.service.ts` | `lotNo` → `matUid` |

**Commit:**

```bash
git commit -m "refactor: Material services Part 1 - arrival/receiving/stock/issue lotNo → matUid"
```

---

## Task 6: Backend Service 수정 — Material 모듈 (Part 2)

**Files:**
- `material/services/iqc-history.service.ts` — lotNo → arrivalNo/matUid
- `material/services/misc-receipt.service.ts` — lotNo → matUid
- `material/services/lot-split.service.ts` — lotNo → matUid
- `material/services/lot-merge.service.ts` — lotNo → matUid
- `material/services/hold.service.ts` — lotNo → matUid
- `material/services/adjustment.service.ts` — lotNo → matUid
- `material/services/physical-inv.service.ts` — lotNo → matUid
- `material/services/label-print.service.ts` — lotNo → matUid, lotIds → uidList
- `material/services/scrap.service.ts` — lotNo → matUid
- `material/services/issue-request.service.ts` — lotNo → matUid
- `material/services/receipt-cancel.service.ts` — lotNo → matUid
- `material/services/shelf-life.service.ts` — lotNo → matUid

**패턴:** 전부 기계적 치환 (`lotNo` → `matUid`)

**Commit:**

```bash
git commit -m "refactor: Material services Part 2 - remaining 12 services lotNo → matUid"
```

---

## Task 7: Backend Service 수정 — Inventory/Production/기타 모듈

**Files:**
- `inventory/services/inventory.service.ts` — lotNo → matUid/prdUid 분리 (55개소)
- `inventory/services/product-inventory.service.ts` — lotNo → prdUid (20개소)
- `inventory/services/product-physical-inv.service.ts` — lotNo → prdUid
- `inventory/services/product-hold.service.ts` — lotNo → prdUid
- `production/services/prod-result.service.ts` — lotNo → prdUid (15개소)
- `production/services/production-views.service.ts` — lotNo → prdUid
- `quality/services/inspect-result.service.ts` — lotNo → matUid/prdUid
- `shipping/services/box.service.ts` — lotNo → prdUid
- `customs/services/customs.service.ts` — lotNo → matUid
- `outsourcing/services/outsourcing.service.ts` — lotNo → matUid

### inventory.service.ts 특수 주의

이 서비스는 자재 재고와 제품 재고를 모두 다룸. 컨텍스트에 따라:
- 자재 관련 쿼리: `lotNo` → `matUid`
- 제품 관련 쿼리: `lotNo` → `prdUid`
- 혼합 쿼리: 분기 필요

**Commit:**

```bash
git commit -m "refactor: Inventory/Production/other services lotNo → matUid/prdUid"
```

---

## Task 8: Backend Controller 수정

**Files:**
- `material/controllers/mat-lot.controller.ts` — lotNo → matUid
- `material/controllers/receiving.controller.ts` — lotNos → matUids
- 기타 관련 컨트롤러 전수 검사

**mat-lot.controller.ts 변경:**

| Before | After |
|--------|-------|
| `@Get('lotno/:lotNo')` | `@Get('by-uid/:matUid')` |
| `@ApiParam({ name: 'lotNo' })` | `@ApiParam({ name: 'matUid' })` |
| `findByLotNo(@Param('lotNo') lotNo: string)` | `findByMatUid(@Param('matUid') matUid: string)` |

**Commit:**

```bash
git commit -m "refactor: Backend controllers lotNo → matUid/prdUid"
```

---

## Task 9: Backend 빌드 검증 (중간 체크포인트)

**Step 1: TypeScript 컴파일 체크**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -50
```

Expected: 0 errors (또는 에러 발생 시 수정)

**Step 2: Grep으로 잔여 lotNo 확인**

```bash
grep -rn "lotNo" apps/backend/src/ --include="*.ts" | grep -v node_modules | grep -v ".spec."
```

Expected: 0건 (또는 의도적 잔여만)

**Step 3: 에러 수정 후 Commit**

```bash
git commit -m "fix: resolve backend compilation errors after lotNo → matUid/prdUid rename"
```

---

## Task 10: Frontend Types & Hooks 수정

**Files:**
- `frontend/src/types/index.ts` — `MaterialLot.lotNo` → `matUid`
- `frontend/src/types/cutting.ts` — `WireReel.lotNo` → `matUid`
- `frontend/src/lib/table-utils/column-factories.tsx` — `accessorKey: "lotNo"` 분기
- `frontend/src/hooks/material/useArrivalData.ts` — lotNo 제거, supUid/invoiceNo 추가
- `frontend/src/hooks/material/useBarcodeScan.ts` — lotNo → matUid
- `frontend/src/hooks/material/useIqcData.ts` — lotNo → matUid/arrivalNo
- `frontend/src/hooks/material/useManualIssue.ts` — lotNo → matUid
- `frontend/src/hooks/material/useReceivingData.ts` — lotNo → matUid

**패턴:** 인터페이스 필드명 + API 엔드포인트 + 데이터 매핑 모두 변경

**특수 변경 - useBarcodeScan.ts:**

| Before | After |
|--------|-------|
| `ScannedLot.lotNo` | `ScannedLot.matUid` |
| `/material/lots/by-lotno/${lotNo}` | `/material/lots/by-uid/${matUid}` |

**Commit:**

```bash
git commit -m "refactor: Frontend types & hooks lotNo → matUid/prdUid"
```

---

## Task 11: Frontend PDA Hooks 수정

**Files:**
- `frontend/src/hooks/pda/useMatAdjustment.ts` — lotNo → matUid (8개소)
- `frontend/src/hooks/pda/useMatInventoryCount.ts` — lotNo → matUid (8개소)
- `frontend/src/hooks/pda/useMatIssuingScan.ts` — lotNo → matUid (8개소)
- `frontend/src/hooks/pda/useMatReceivingScan.ts` — lotNo → matUid

**패턴:** 인터페이스 + 함수 파라미터 + API 엔드포인트 + 데이터 구성 모두 변경

**Commit:**

```bash
git commit -m "refactor: PDA hooks lotNo → matUid"
```

---

## Task 12: Frontend Pages — Material (14개)

**Files:**
- `material/lot/page.tsx` — lotNo → matUid (인터페이스, 컬럼, 검색, 상세)
- `material/hold/page.tsx` — lotNo → matUid
- `material/receive/page.tsx` — lotNo → matUid
- `material/stock/page.tsx` — lotNo → matUid
- `material/scrap/page.tsx` — lotNo → matUid
- `material/receive-label/page.tsx` — lotNo → matUid (대규모 변경, Task 17에서 재설계)
- `material/lot-split/page.tsx` — lotNo → matUid
- `material/lot-merge/page.tsx` — lotNo → matUid
- `material/arrival-stock/page.tsx` — lotNo 제거
- `material/iqc-history/page.tsx` — lotNo → arrivalNo/matUid
- `material/physical-inv/page.tsx` — lotNo → matUid
- `material/physical-inv-history/page.tsx` — lotNo → matUid
- `material/receipt-cancel/page.tsx` — lotNo → matUid
- `material/shelf-life/page.tsx` — lotNo → matUid

**패턴:** 각 페이지의 Interface, 컬럼 정의, API 파라미터, 상세보기 표시 일괄 변경

**Commit:**

```bash
git commit -m "refactor: Material pages lotNo → matUid (14 files)"
```

---

## Task 13: Frontend Pages — Inventory (9개)

**Files:**
- `inventory/lot/page.tsx` — lotNo → matUid (12개소, 가장 변경 많음)
- `inventory/material-stock/page.tsx` — lotNo → matUid
- `inventory/material-physical-inv/page.tsx` — lotNo → matUid
- `inventory/material-physical-inv-history/page.tsx` — lotNo → matUid
- `inventory/stock/page.tsx` — lotNo → 자재: matUid, 제품: prdUid 분기
- `inventory/transaction/page.tsx` — lotNo → matUid/prdUid
- `inventory/product-hold/page.tsx` — lotNo → prdUid
- `inventory/product-physical-inv/page.tsx` — lotNo → prdUid
- `inventory/product-physical-inv-history/page.tsx` — lotNo → prdUid

**특수 주의: `inventory/stock/page.tsx`와 `inventory/transaction/page.tsx`**

이 페이지들은 자재/제품 혼합 데이터를 보여주므로, 타입에 따라 `matUid` 또는 `prdUid`를 표시해야 함.

**Commit:**

```bash
git commit -m "refactor: Inventory pages lotNo → matUid/prdUid (9 files)"
```

---

## Task 14: Frontend Pages — Production/Quality/기타 (11개)

**Files:**
- `production/input-manual/page.tsx` — lotNo → matUid (10개소)
- `production/input-machine/page.tsx` — lotNo → matUid (9개소)
- `production/input-inspect/page.tsx` — lotNo → matUid (7개소)
- `production/input-equip/page.tsx` — lotNo → matUid
- `production/result/page.tsx` — lotNo → prdUid
- `production/pack-result/page.tsx` — lotNo → prdUid
- `production/wip-stock/page.tsx` — lotNo → prdUid
- `quality/trace/page.tsx` — lotNo → matUid + prdUid 분리
- `customs/stock/page.tsx` — lotNo → matUid
- `customs/usage/page.tsx` — lotNo → matUid
- `product/receive/page.tsx` — lotNo → prdUid

**Commit:**

```bash
git commit -m "refactor: Production/Quality/Customs/Product pages lotNo → matUid/prdUid"
```

---

## Task 15: Frontend Components 수정 (17개)

**Files:**
- `components/material/ArrivalModal.tsx` — lotNo 제거, supUid/invoiceNo 추가
- `components/material/ArrivalTable.tsx` — lotNo 컬럼 제거, supUid 컬럼 추가
- `components/material/BarcodeScanTab.tsx` — lotNo → matUid
- `components/material/IqcModal.tsx` — lotNo → arrivalNo
- `components/material/IqcTable.tsx` — lotNo → arrivalNo
- `components/material/IssueHistoryTab.tsx` — lotNo → matUid
- `components/material/ManualIssueTab.tsx` — lotNo → matUid
- `components/material/ReceivingConfirmModal.tsx` — lotNo → matUid
- `components/material/ReceivingTable.tsx` — lotNo → matUid
- `material/receive-label/components/LabelPreviewRenderer.tsx` — lotNo → matUid
- `material/receive-label/components/PrintActionBar.tsx` — lotNos → matUids
- `material/receive-label/components/PrintHistorySection.tsx` — lotNos → matUids
- `material/receive-label/components/useReceiveLabelColumns.tsx` — lotNo → matUid
- `material/receive/components/types.ts` — lotNo → matUid
- `material/receive/components/ReceivableTable.tsx` — lotNo → matUid
- `material/arrival/components/ManualArrivalModal.tsx` — lotNo 제거, supUid 추가
- `material/arrival/components/types.ts` — lotNo 제거, supUid/invoiceNo 추가
- `material/scrap/components/ScrapRegisterModal.tsx` — lotNo → matUid
- `master/label/components/ZplEditor.tsx` — lotNo → matUid

**Commit:**

```bash
git commit -m "refactor: Frontend components lotNo → matUid/prdUid (17 files)"
```

---

## Task 16: Frontend PDA Pages 수정 (4개)

**Files:**
- `pda/material/receiving/page.tsx` — lotNo → matUid
- `pda/material/issuing/page.tsx` — lotNo → matUid
- `pda/material/inventory-count/page.tsx` — lotNo → matUid
- `pda/material/adjustment/page.tsx` — lotNo → matUid

**Commit:**

```bash
git commit -m "refactor: PDA pages lotNo → matUid"
```

---

## Task 17: i18n 4개 언어 수정

**Files:**
- `frontend/src/locales/ko.json`
- `frontend/src/locales/en.json`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/vi.json`

**변경 패턴:**

| 기존 키 | 새 키/값 변경 |
|---------|-------------|
| `"lotNo": "LOT 번호"` | `"matUid": "자재시리얼"` (ko) |
| `"lotNo": "LOT No."` | `"matUid": "Material Serial"` (en) |
| `"lotNo": "批号"` | `"matUid": "材料序列号"` (zh) |
| `"lotNo": "Số Lô"` | `"matUid": "Số Serial Vật Liệu"` (vi) |

**추가 키:**

| 키 | ko | en | zh | vi |
|----|----|----|----|----|
| `prdUid` | 제품시리얼 | Product Serial | 产品序列号 | Số Serial Sản Phẩm |
| `supUid` | 공급상시리얼 | Supplier Serial | 供应商序列号 | Số Serial Nhà Cung Cấp |

**각 언어 파일에서 `"lot"` 관련 키 약 20개씩 수정 필요**

**Commit:**

```bash
git commit -m "refactor: i18n lotNo → matUid/prdUid/supUid labels (ko/en/zh/vi)"
```

---

## Task 18: Frontend 빌드 검증 (중간 체크포인트)

**Step 1: TypeScript + Next.js 빌드**

```bash
cd apps/frontend && npx next build 2>&1 | tail -30
```

**Step 2: Grep으로 잔여 lotNo 확인**

```bash
grep -rn "lotNo" apps/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: 0건

**Step 3: 에러 수정 후 Commit**

```bash
git commit -m "fix: resolve frontend compilation errors after lotNo → matUid/prdUid rename"
```

---

## Task 19: 신규 — ReceiveLabelService (Backend)

**Files:**
- Create: `apps/backend/src/modules/material/services/receive-label.service.ts`
- Create: `apps/backend/src/modules/material/dto/receive-label.dto.ts`
- Create: `apps/backend/src/modules/material/controllers/receive-label.controller.ts`
- Modify: `apps/backend/src/modules/material/material.module.ts`

**Step 1: DTO 작성**

```typescript
/**
 * @file receive-label.dto.ts
 * @description 자재 라벨 발행(matUid 채번) 요청/응답 DTO
 */
import { IsArray, IsString, IsInt, Min, Max } from 'class-validator';

export class CreateMatLabelsDto {
  @IsInt()
  arrivalId: number;          // 입하 ID

  @IsInt() @Min(1) @Max(999)
  qty: number;                // 발행 수량 (= matUid 채번 수)

  @IsString({ each: true })
  @IsArray()
  supUids?: string[];         // 공급상시리얼 (선택, qty와 같은 길이 또는 생략)
}

export class MatLabelResultDto {
  matUid: string;
  itemCode: string;
  itemName: string;
  supUid: string | null;
}
```

**Step 2: Service 작성**

```typescript
/**
 * @file receive-label.service.ts
 * @description IQC PASS 입하건 → matUid 채번 → MatLot 생성 → 라벨 발행
 */
@Injectable()
export class ReceiveLabelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly uidGenerator: UidGeneratorService,
    @InjectRepository(MatArrival) private readonly arrivalRepo: Repository<MatArrival>,
    @InjectRepository(MatLot) private readonly matLotRepo: Repository<MatLot>,
    @InjectRepository(PartMaster) private readonly partRepo: Repository<PartMaster>,
    @InjectRepository(LabelPrintLog) private readonly printLogRepo: Repository<LabelPrintLog>,
  ) {}

  /** IQC PASS + 미발행 입하건 조회 */
  async findLabelableArrivals(): Promise<any[]> {
    return this.arrivalRepo.createQueryBuilder('a')
      .where('a.iqcStatus = :status', { status: 'PASS' })
      .orderBy('a.createdAt', 'DESC')
      .getMany();
  }

  /** matUid 채번 + MatLot 생성 + 라벨 인쇄 로그 */
  async createMatLabels(dto: CreateMatLabelsDto): Promise<MatLabelResultDto[]> {
    const arrival = await this.arrivalRepo.findOneOrFail({ where: { id: dto.arrivalId } });
    const part = await this.partRepo.findOne({ where: { itemCode: arrival.itemCode } });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: MatLabelResultDto[] = [];

      for (let i = 0; i < dto.qty; i++) {
        const matUid = await this.uidGenerator.nextMatUid(queryRunner);
        const lot = queryRunner.manager.create(MatLot, {
          matUid,
          itemCode: arrival.itemCode,
          initQty: 1,
          currentQty: 1,
          recvDate: new Date(),
          poNo: arrival.poNo,
          vendor: arrival.vendor,
        });
        await queryRunner.manager.save(lot);

        results.push({
          matUid,
          itemCode: arrival.itemCode,
          itemName: part?.itemName ?? '',
          supUid: dto.supUids?.[i] ?? arrival.supUid ?? null,
        });
      }

      // 인쇄 로그 저장
      const log = queryRunner.manager.create(LabelPrintLog, {
        category: 'mat_uid',
        printMode: 'BROWSER',
        uidList: JSON.stringify(results.map(r => r.matUid)),
        labelCount: dto.qty,
        status: 'SUCCESS',
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
```

**Step 3: Controller 작성**

```typescript
/**
 * @file receive-label.controller.ts
 * @description 자재 라벨 발행 API
 */
@Controller('material/receive-label')
export class ReceiveLabelController {
  constructor(private readonly service: ReceiveLabelService) {}

  @Get('arrivals')
  async findLabelable() {
    return { data: await this.service.findLabelableArrivals() };
  }

  @Post('create')
  async createLabels(@Body() dto: CreateMatLabelsDto) {
    return { data: await this.service.createMatLabels(dto) };
  }
}
```

**Step 4: material.module.ts에 등록**

- imports에 필요한 Repository 추가
- providers에 `ReceiveLabelService` 추가
- controllers에 `ReceiveLabelController` 추가

**Commit:**

```bash
git commit -m "feat: add ReceiveLabelService — matUid generation at label printing time"
```

---

## Task 20: 신규 — 자재 라벨 발행 페이지 재설계 (Frontend)

**Files:**
- Rewrite: `material/receive-label/page.tsx`
- Modify: `material/receive-label/components/useReceiveLabelColumns.tsx`
- Modify: `material/receive-label/components/PrintActionBar.tsx`

**핵심 변경:**
- 기존: IQC 합격 LOT 목록 → 선택 → 인쇄
- 신규: IQC 합격 **입하건** 목록 → 선택 → qty만큼 matUid 생성 + 인쇄

**페이지 구조:**
```
[통계 카드: 전체 입하건 | IQC PASS | 미발행 | 발행완료]
[DataGrid: 입하건 목록 (arrivalNo, itemCode, itemName, qty, iqcStatus, supUid, 발행여부)]
[수량 입력 + 발행 버튼]
[결과 DataGrid: 방금 생성된 matUid 목록]
[인쇄 이력]
```

**Commit:**

```bash
git commit -m "feat: redesign receive-label page — arrival-based matUid label printing"
```

---

## Task 21: 신규 — ProductLabelService (Backend)

**Files:**
- Create: `apps/backend/src/modules/production/services/product-label.service.ts`
- Create: `apps/backend/src/modules/production/dto/product-label.dto.ts`
- Create: `apps/backend/src/modules/production/controllers/product-label.controller.ts`
- Modify: `apps/backend/src/modules/production/production.module.ts`

**핵심 로직:**
- 생산실적(ProdResult) 또는 OQC PASS 건 조회
- prdUid 채번 (DB Function) → 제품 라벨 발행
- 두 경로 모두 동일한 Service 메서드 사용

```typescript
@Injectable()
export class ProductLabelService {
  /** 라벨 발행 가능한 생산실적 조회 (미발행건) */
  async findLabelableResults(): Promise<any[]> { ... }

  /** 라벨 발행 가능한 OQC PASS 건 조회 */
  async findLabelableOqcPassed(): Promise<any[]> { ... }

  /** prdUid 채번 + 제품 라벨 발행 */
  async createPrdLabels(dto: CreatePrdLabelsDto): Promise<PrdLabelResultDto[]> {
    // qty만큼 prdUid 채번 → ProductStock INSERT → LabelPrintLog
  }
}
```

**Commit:**

```bash
git commit -m "feat: add ProductLabelService — prdUid generation at product label printing"
```

---

## Task 22: 전체 빌드 검증 + 잔여 lotNo 전수 검사

**Step 1: Backend 빌드**

```bash
cd apps/backend && npx tsc --noEmit
```

**Step 2: Frontend 빌드**

```bash
cd apps/frontend && npx next build
```

**Step 3: 전체 Grep**

```bash
grep -rn "lotNo\|lot_no\|lotIds\|LOT_NO\|LOT_IDS" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".spec."
```

Expected: 0건 (또는 의도적 잔여 — 주석/문서만)

**Step 4: i18n 누락 검사**

```bash
# 새 키가 4개 언어에 모두 존재하는지
grep -c "matUid" apps/frontend/src/locales/*.json
grep -c "prdUid" apps/frontend/src/locales/*.json
grep -c "supUid" apps/frontend/src/locales/*.json
```

**Step 5: 최종 Commit**

```bash
git commit -m "chore: final build verification — 0 errors, 0 lotNo references"
```

---

## 요약 통계

| Task | 범위 | 파일 수 |
|------|------|--------|
| 1 | DB Function + UidGeneratorService | 3 |
| 2-3 | Entity 변경 | 16 |
| 4 | DTO 변경 | 18 |
| 5-7 | Service 변경 | 25+ |
| 8 | Controller 변경 | 2+ |
| 9 | Backend 빌드 검증 | - |
| 10-11 | Frontend Hooks | 12 |
| 12-14 | Frontend Pages | 34+ |
| 15 | Frontend Components | 17+ |
| 16 | Frontend PDA | 4 |
| 17 | i18n | 4 |
| 18 | Frontend 빌드 검증 | - |
| 19-20 | ReceiveLabelService 신규 | 5+ |
| 21 | ProductLabelService 신규 | 4+ |
| 22 | 최종 검증 | - |
| **합계** | | **~150 파일** |
