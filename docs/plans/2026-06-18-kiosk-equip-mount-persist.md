# 입력 키오스크 설비 장착 상태 서버 영속화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입력 키오스크에서 설비를 키로 작업지시(1건)·작업자(1명)를 서버 DB에 저장/복원하여, localStorage 의존 없이 어느 단말에서도 동일하게 유지하고 해제(수동 버튼 + 작업지시 DONE 자동) 전까지 보존한다.

**Architecture:** `EQUIP_MASTERS`에 `CURRENT_WORKER_ID` 컬럼 1개만 추가(작업지시는 기존 `CURRENT_JOB_ORDER_ID` 재사용). 백엔드에 mount 조회/작업자 할당/통합 해제 API를 추가하고, 작업지시 완료 트랜잭션에서 장착 설비를 자동 clear한다. 프론트는 Zustand `persist`에서 작업지시·작업자를 빼고, 설비 선택 시 서버 mount를 읽어 기존 작업지시/작업자 조회 API로 복원한다.

**Tech Stack:** NestJS + TypeORM + Oracle(JSHANES) / Next.js + Zustand / Jest(백엔드 spec) + node:test 구조 테스트(.mjs)

---

## 사전 준비

- [ ] **편집 전 `.ai-coordination/LOCKS.md`에 본 작업 lock 기록** (task: `T-KIOSK-EQUIP-MOUNT-PERSIST`, owner: claude). input-kiosk 영역은 codex가 활발하니 충돌 방지. 대상 파일은 아래 File Structure 참고.

## File Structure

**백엔드 (생성/수정)**
- Modify: `apps/backend/src/entities/equip-master.entity.ts` — `currentWorkerId` 컬럼 추가
- Create: `apps/backend/src/migrations/2026-06-18_equip_current_worker_id.sql` — DDL
- Modify: `apps/backend/src/modules/equipment/dto/equip-master.dto.ts` — `AssignWorkerDto`
- Modify: `apps/backend/src/modules/equipment/services/equip-master.service.ts` — `getMount`/`assignWorker`/`clearMount`
- Modify: `apps/backend/src/modules/equipment/controllers/equip-master.controller.ts` — 3개 라우트
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts` — `complete()` 자동 해제
- Create: `apps/backend/src/modules/equipment/services/equip-master.mount.spec.ts` — 단위 테스트

**프론트 (생성/수정)**
- Create: `apps/frontend/src/components/production/jobOrderMapper.ts` — 작업지시 raw→`JobOrder` 매핑(DRY)
- Modify: `apps/frontend/src/components/production/JobOrderSelectModal.tsx` — 위 매퍼 사용
- Modify: `apps/frontend/src/stores/kioskStore.ts` — persist 축소 + `setWorker`/`clearMount`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx` — mount 복원/작업자 저장/해제
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx` — 작업 해제 버튼(+확인 모달)
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json` — 해제 버튼/모달 문구
- Create: `apps/frontend/src/app/(authenticated)/production/input-kiosk/kiosk-equip-mount-persist.structure.test.mjs` — 구조 테스트

---

## Task 1: DB 컬럼 + 엔티티

**Files:**
- Modify: `apps/backend/src/entities/equip-master.entity.ts:68-69`
- Create: `apps/backend/src/migrations/2026-06-18_equip_current_worker_id.sql`

- [ ] **Step 1: 엔티티에 컬럼 추가**

`equip-master.entity.ts`의 `currentJobOrderId` 정의 바로 아래에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'CURRENT_JOB_ORDER_ID', length: 50, nullable: true })
  currentJobOrderId: string | null;

  @Column({ type: 'varchar2', name: 'CURRENT_WORKER_ID', length: 50, nullable: true })
  currentWorkerId: string | null;
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`2026-06-18_equip_current_worker_id.sql`:

```sql
-- 설비 현재 작업자(1:1) 컬럼 추가 — 입력 키오스크 장착 상태 서버 영속화
ALTER TABLE EQUIP_MASTERS ADD (CURRENT_WORKER_ID VARCHAR2(50));
COMMENT ON COLUMN EQUIP_MASTERS.CURRENT_WORKER_ID IS '현재 장착 작업자 코드(WORKER_MASTERS.WORKER_CODE), null이면 미배정';
```

- [ ] **Step 3: JSHANES에 DDL 적용**

`oracle-db` 스킬(또는 검증된 SQL 경로)로 JSHANES 사이트에 위 ALTER 실행. nullable 추가라 기존 행 영향 없음.
적용 후 컬럼 존재 확인:
```sql
SELECT COLUMN_NAME, DATA_TYPE, NULLABLE FROM USER_TAB_COLUMNS
WHERE TABLE_NAME='EQUIP_MASTERS' AND COLUMN_NAME='CURRENT_WORKER_ID';
```
Expected: `CURRENT_WORKER_ID | VARCHAR2 | Y` 1행.

- [ ] **Step 4: EQUIP_MASTERS 의존 PL/SQL 무효화 점검**

```sql
SELECT NAME, TYPE, STATUS FROM USER_DEPENDENCIES d
JOIN USER_OBJECTS o ON o.OBJECT_NAME = d.NAME
WHERE d.REFERENCED_NAME='EQUIP_MASTERS' AND o.STATUS='INVALID';
```
INVALID가 있으면 `ALTER PACKAGE <name> COMPILE;`로 재컴파일. (참고: DDL→PL/SQL INVALID→ORA-04068 1회성 리스크)

- [ ] **Step 5: 백엔드 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/entities/equip-master.entity.ts apps/backend/src/migrations/2026-06-18_equip_current_worker_id.sql
git commit -m "feat(equip): EQUIP_MASTERS.CURRENT_WORKER_ID 컬럼 추가 (키오스크 작업자 영속화)"
```

---

## Task 2: 백엔드 mount 조회 / 작업자 할당 / 통합 해제

**Files:**
- Modify: `apps/backend/src/modules/equipment/dto/equip-master.dto.ts:166-171` (AssignJobOrderDto 아래)
- Modify: `apps/backend/src/modules/equipment/services/equip-master.service.ts:405` (assignJobOrder 아래)
- Modify: `apps/backend/src/modules/equipment/controllers/equip-master.controller.ts:224` (assignJobOrder 라우트 아래)
- Test: `apps/backend/src/modules/equipment/services/equip-master.mount.spec.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`equip-master.mount.spec.ts` — `getMount`/`assignWorker`/`clearMount`의 repository 호출을 모킹해 검증:

```typescript
import { EquipMasterService } from './equip-master.service';

type Row = Record<string, unknown>;

function makeService(equipRow: Row | null) {
  const equipRepo = {
    findOne: jest.fn().mockResolvedValue(equipRow),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  // findById는 내부에서 equipRepo.findOne을 사용한다고 가정 — 실제 구현에 맞춰 조정
  const svc = new EquipMasterService(equipRepo as never, {} as never, {} as never);
  return { svc, equipRepo };
}

describe('EquipMasterService mount', () => {
  it('getMount: 장착 작업지시/작업자 코드를 반환', async () => {
    const { svc } = makeService({
      equipCode: 'EQ1', status: 'NORMAL', useYn: 'Y',
      currentJobOrderId: 'WO1', currentWorkerId: 'W1', company: '40', plant: '1000',
    });
    const r = await svc.getMount('EQ1', '40', '1000');
    expect(r).toEqual({ orderNo: 'WO1', workerCode: 'W1' });
  });

  it('getMount: 미장착이면 null', async () => {
    const { svc } = makeService({
      equipCode: 'EQ1', status: 'NORMAL', useYn: 'Y',
      currentJobOrderId: null, currentWorkerId: null, company: '40', plant: '1000',
    });
    expect(await svc.getMount('EQ1', '40', '1000')).toEqual({ orderNo: null, workerCode: null });
  });

  it('assignWorker: currentWorkerId 갱신', async () => {
    const { svc, equipRepo } = makeService({
      equipCode: 'EQ1', status: 'NORMAL', useYn: 'Y',
      currentJobOrderId: null, currentWorkerId: null, company: '40', plant: '1000',
    });
    await svc.assignWorker('EQ1', { workerCode: 'W2' }, '40', '1000');
    expect(equipRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ equipCode: 'EQ1' }),
      { currentWorkerId: 'W2' },
    );
  });

  it('clearMount: 작업지시+작업자 동시 null', async () => {
    const { svc, equipRepo } = makeService({
      equipCode: 'EQ1', status: 'NORMAL', useYn: 'Y',
      currentJobOrderId: 'WO1', currentWorkerId: 'W1', company: '40', plant: '1000',
    });
    await svc.clearMount('EQ1', '40', '1000');
    expect(equipRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ equipCode: 'EQ1' }),
      { currentJobOrderId: null, currentWorkerId: null },
    );
  });
});
```

> 주: 생성자 인자 순서/`findById` 내부 동작은 실제 `equip-master.service.ts`를 보고 정확히 맞춘다(서비스는 `equipMasterRepository`, `lineRepository`, `processRepository` 3개 주입). `findById`가 `findOne` + `withClientId`를 쓰면 모킹을 그에 맞게 조정.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @harness/backend exec jest equip-master.mount`
Expected: FAIL — `getMount`/`assignWorker`/`clearMount` 미정의.

- [ ] **Step 3: DTO 추가**

`equip-master.dto.ts`의 `AssignJobOrderDto` 아래에:

```typescript
/**
 * 설비 작업자 할당 DTO (1:1)
 */
export class AssignWorkerDto {
  @ApiProperty({ description: '작업자 코드(null이면 해제)', example: 'W001' })
  @IsOptional()
  @IsString()
  workerCode?: string | null;
}
```

- [ ] **Step 4: 서비스 메서드 추가**

`equip-master.service.ts`의 `assignJobOrder` 아래에:

```typescript
  /**
   * 설비 현재 장착 상태(작업지시·작업자 코드) 조회 — 키오스크 복원용
   */
  async getMount(equipCode: string, company?: string, plant?: string) {
    const equip = await this.findById(equipCode, company, plant);
    return {
      orderNo: equip.currentJobOrderId ?? null,
      workerCode: equip.currentWorkerId ?? null,
    };
  }

  /**
   * 설비에 작업자 할당/해제 (1:1)
   */
  async assignWorker(equipCode: string, dto: AssignWorkerDto, company?: string, plant?: string) {
    await this.findById(equipCode, company, plant); // 존재 검증(없으면 NotFound)
    await this.equipMasterRepository.update(
      { equipCode, ...this.tenantWhere(company, plant) },
      { currentWorkerId: dto.workerCode ?? null },
    );
    this.logger.log(
      dto.workerCode
        ? `설비 작업자 할당: ${equipCode} → ${dto.workerCode}`
        : `설비 작업자 해제: ${equipCode}`,
    );
    return this.findById(equipCode, company, plant);
  }

  /**
   * 설비 장착 상태 전체 해제 (작업지시+작업자) — 작업 종료
   */
  async clearMount(equipCode: string, company?: string, plant?: string) {
    await this.findById(equipCode, company, plant);
    await this.equipMasterRepository.update(
      { equipCode, ...this.tenantWhere(company, plant) },
      { currentJobOrderId: null, currentWorkerId: null },
    );
    this.logger.log(`설비 장착 해제(작업 종료): ${equipCode}`);
    return this.findById(equipCode, company, plant);
  }
```

`AssignWorkerDto`를 import 목록(`equip-master.dto`)에 추가.

- [ ] **Step 5: 컨트롤러 라우트 추가**

`equip-master.controller.ts`의 `assignJobOrder` 라우트 아래에:

```typescript
  @Get(':id/mount')
  @ApiOperation({ summary: '설비 현재 장착 작업지시/작업자 코드 조회' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  async getMount(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.getMount(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Patch(':id/worker')
  @ApiOperation({ summary: '설비에 작업자 할당/해제 (1:1)' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  async assignWorker(
    @Param('id') id: string,
    @Body() dto: AssignWorkerDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.assignWorker(id, dto, company, plant);
    return ResponseUtil.success(data, dto.workerCode ? '작업자가 할당되었습니다.' : '작업자가 해제되었습니다.');
  }

  @Delete(':id/mount')
  @ApiOperation({ summary: '설비 장착 상태 전체 해제(작업 종료)' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  async clearMount(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.clearMount(id, company, plant);
    return ResponseUtil.success(data, '작업이 해제되었습니다.');
  }
```

`AssignWorkerDto`를 dto import에 추가하고, `Get`/`Patch`/`Delete`/`Body`가 `@nestjs/common` import에 포함됐는지 확인(없으면 추가).

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter @harness/backend exec jest equip-master.mount`
Expected: PASS 4건.

- [ ] **Step 7: 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 0건.

- [ ] **Step 8: 커밋**

```bash
git add apps/backend/src/modules/equipment/dto/equip-master.dto.ts apps/backend/src/modules/equipment/services/equip-master.service.ts apps/backend/src/modules/equipment/controllers/equip-master.controller.ts apps/backend/src/modules/equipment/services/equip-master.mount.spec.ts
git commit -m "feat(equip): 설비 mount 조회/작업자 할당/통합 해제 API"
```

---

## Task 3: 작업지시 DONE 시 장착 자동 해제

**Files:**
- Modify: `apps/backend/src/modules/production/services/job-order.service.ts:601-617` (`complete` 트랜잭션)

- [ ] **Step 1: complete 트랜잭션에 EquipMaster mount clear 추가**

`complete()`의 `this.tx.run` 콜백 내부, JobOrder update 직후에 추가:

```typescript
      await queryRunner.manager.update(JobOrder, { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, {
        status: 'DONE',
        endAt: new Date(),
        goodQty: summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0,
        defectQty: summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0,
      });

      // 완료된 작업지시를 장착 중이던 설비의 장착 상태를 자동 해제(작업지시+작업자)
      await queryRunner.manager.update(
        EquipMaster,
        { currentJobOrderId: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        { currentJobOrderId: null, currentWorkerId: null },
      );
```

- [ ] **Step 2: EquipMaster 엔티티 import 추가**

`job-order.service.ts` 상단 import에 (없으면):

```typescript
import { EquipMaster } from '../../../entities/equip-master.entity';
```

> `queryRunner.manager.update`는 엔티티 클래스만 있으면 되므로 추가 repo 주입/모듈 import 불필요.

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 0건.

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/production/services/job-order.service.ts
git commit -m "feat(job-order): 작업지시 완료 시 장착 설비 mount 자동 해제"
```

---

## Task 4: 프론트 작업지시 매핑 유틸 분리 (DRY)

**Files:**
- Create: `apps/frontend/src/components/production/jobOrderMapper.ts`
- Modify: `apps/frontend/src/components/production/JobOrderSelectModal.tsx:53-70`

- [ ] **Step 1: 매핑 유틸 작성**

현재 `JobOrderSelectModal.tsx`의 인라인 매핑(53-70행)을 그대로 함수로 추출. `jobOrderMapper.ts`:

```typescript
import type { JobOrder } from './JobOrderSelectModal';

/** 작업지시 목록 API raw 행을 화면용 JobOrder(JobOrderSelectItem)로 변환 */
export function mapJobOrderRow(jo: Record<string, unknown>): JobOrder {
  const part = jo.part as Record<string, unknown> | undefined;
  return {
    id: jo.orderNo as string,
    orderNo: jo.orderNo as string,
    itemCode: jo.itemCode as string,
    itemName: (part?.itemName ?? jo.itemCode) as string,
    itemType: part?.itemType as string | undefined,
    processType: jo.processType as string | undefined,
    processCode: jo.processCode as string | undefined,
    planQty: jo.planQty as number,
    completedQty: (jo.goodQty ?? 0) as number,
    status: jo.status as string,
    planStartDate: jo.planDate ? String(jo.planDate).slice(0, 10) : '',
    planEndDate: jo.planDate ? String(jo.planDate).slice(0, 10) : '',
    workDate: jo.planDate ? String(jo.planDate).slice(0, 10) : undefined,
    equipCode: jo.equipCode as string | undefined,
    equipName: jo.equipName as string | undefined,
  };
}
```

> `JobOrderSelectModal.tsx`의 현재 매핑이 위 필드를 모두 덮는지 직접 비교해 1:1 일치시킨다(누락 필드 있으면 추가). `JobOrder = JobOrderSelectItem`.

- [ ] **Step 2: JobOrderSelectModal에서 유틸 사용**

`JobOrderSelectModal.tsx`의 `fetchJobOrders` 내 `.map(...)` 블록을 교체:

```typescript
      const items: JobOrder[] = (res.data?.data ?? []).map(
        (jo: Record<string, unknown>) => mapJobOrderRow(jo),
      );
```
상단에 `import { mapJobOrderRow } from './jobOrderMapper';` 추가.

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 0건.

- [ ] **Step 4: 커밋**

```bash
git add apps/frontend/src/components/production/jobOrderMapper.ts apps/frontend/src/components/production/JobOrderSelectModal.tsx
git commit -m "refactor(production): 작업지시 행 매핑 유틸 분리(mapJobOrderRow)"
```

---

## Task 5: 프론트 store — persist 축소 + 작업자 1:1 + clearMount

**Files:**
- Modify: `apps/frontend/src/stores/kioskStore.ts:75-94` (인터페이스), `103-233` (구현/partialize)

- [ ] **Step 1: store 인터페이스에 액션 추가**

`KioskState` 인터페이스의 `addWorker` 근처에 추가:

```typescript
  /** 작업자 1:1 설정(교체). null이면 비움 */
  setWorker: (worker: Worker | null) => void;
  /** 작업 종료 — 설비는 유지, 작업지시·작업자·스캔·인터락만 초기화 */
  clearMount: () => void;
```

- [ ] **Step 2: 액션 구현 추가**

`addWorker` 구현 아래에:

```typescript
      setWorker: (worker) => set({ selectedWorkers: worker ? [worker] : [] }),

      clearMount: () => set({
        selectedJobOrder: null,
        selectedWorkers: [],
        serialSeq: 1,
        interlock: DEFAULT_INTERLOCK,
        scannedMaterialLots: [],
        pendingDefects: [],
        savedResultCount: 0,
        hasPendingDelegate: false,
        midInspectDone: false,
      }),
```

- [ ] **Step 3: persist 대상에서 작업지시·작업자 제거**

`partialize`를 수정(서버가 source of truth가 됨):

```typescript
      partialize: (state) => ({
        selectedEquip: state.selectedEquip,
        lotSize: state.lotSize,
      }),
      version: 3,
```

> `selectedJobOrder`, `selectedWorkers`, `interlock`을 persist에서 제거. version 2→3으로 올려 기존 localStorage 상태를 무효화(작업지시/작업자가 더 이상 로컬에 남지 않게).

- [ ] **Step 4: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 0건. (`setWorker`/`clearMount` 미사용 경고는 다음 Task에서 사용하므로 무시 가능, tsc는 통과)

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/stores/kioskStore.ts
git commit -m "feat(kiosk-store): persist 축소(설비·lotSize만) + setWorker/clearMount 추가"
```

---

## Task 6: 프론트 복원/저장/해제 흐름

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx:44-50, 175-178`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx`
- Test: `apps/frontend/src/app/(authenticated)/production/input-kiosk/kiosk-equip-mount-persist.structure.test.mjs`

- [ ] **Step 1: 구조 테스트 작성(실패)**

`kiosk-equip-mount-persist.structure.test.mjs` — 핵심 흐름이 코드에 존재하는지 정적 검증:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(dir, 'page.tsx'), 'utf8');
const header = readFileSync(join(dir, 'components/EquipHeader.tsx'), 'utf8');
const store = readFileSync(join(dir, '../../../../stores/kioskStore.ts'), 'utf8');

test('store persist는 설비·lotSize만 저장', () => {
  assert.match(store, /partialize:\s*\(state\)\s*=>\s*\(\{[\s\S]*?selectedEquip[\s\S]*?lotSize[\s\S]*?\}\)/);
  assert.doesNotMatch(store, /partialize:[\s\S]*?selectedJobOrder/);
  assert.doesNotMatch(store, /partialize:[\s\S]*?selectedWorkers/);
  assert.match(store, /version:\s*3/);
});

test('설비 선택 시 mount 복원 호출', () => {
  assert.match(page, /\/equipment\/equips\/[^']*\/mount/);
});

test('작업자 선택 시 서버 PATCH worker 저장', () => {
  assert.match(page, /\/equipment\/equips\/[^']*\/worker/);
  assert.match(page, /setWorker/);
});

test('해제 버튼이 DELETE mount + clearMount 호출', () => {
  assert.match(header, /onReleaseMount|onClearMount|작업\s*종료|releaseMount/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/kiosk-equip-mount-persist.structure.test.mjs`
Expected: FAIL (복원/저장/해제 코드 아직 없음).

- [ ] **Step 3: page.tsx — store에서 setWorker/clearMount 가져오기**

`useKioskStore()` 구조분해에 추가:

```typescript
  const {
    selectedEquip, selectedJobOrder, interlock, savedResultCount, hasPendingDelegate,
    selectedWorkers, midInspectDone,
    addWorker, setSelectedJobOrder, setInterlock, setSavedResultCount, setHasPendingDelegate,
    setWorker, clearMount,
  } = useKioskStore();
```

- [ ] **Step 4: page.tsx — 설비 선택 시 서버 mount 복원**

설비 목록 로드 useEffect(`page.tsx:68-72`) 아래에 복원 effect 추가:

```typescript
  // 설비 선택 시 → 서버에 장착된 작업지시/작업자를 복원(localStorage 비의존)
  useEffect(() => {
    const code = selectedEquip?.equipCode;
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/equipment/equips/${code}/mount`);
        const mount = res.data?.data as { orderNo: string | null; workerCode: string | null } | undefined;
        if (cancelled || !mount) return;

        // 작업지시 복원
        if (mount.orderNo) {
          const jr = await api.get('/production/job-orders', { params: { orderNo: mount.orderNo, limit: 1 } });
          const row = (jr.data?.data ?? []).find(
            (j: Record<string, unknown>) => j.orderNo === mount.orderNo,
          );
          if (!cancelled && row) setSelectedJobOrder(mapJobOrderRow(row));
        }

        // 작업자 복원
        if (mount.workerCode) {
          const wr = await api.get(`/master/workers/${mount.workerCode}`);
          const w = wr.data?.data as Record<string, unknown> | undefined;
          if (!cancelled && w) {
            setWorker({
              id: w.workerCode as string,
              workerCode: w.workerCode as string,
              workerName: w.workerName as string,
              dept: (w.dept ?? '') as string,
              qrCode: w.qrCode as string | undefined,
              photoUrl: (w.photoUrl ?? null) as string | null,
            });
          }
        }
      } catch {
        // 복원 실패 시 빈 상태 유지
      }
    })();
    return () => { cancelled = true; };
    // selectedEquip.equipCode 변경 시에만 복원
  }, [selectedEquip?.equipCode, setSelectedJobOrder, setWorker]);
```

상단 import 추가: `import { mapJobOrderRow } from '@/components/production/jobOrderMapper';`

> 주의: `setSelectedJobOrder`는 인터락/스캔을 초기화하지만, 직후 기존 `refreshDailyInspect`/`refreshWorkerInspect`/`refreshProgress` effect가 서버 기준으로 재동기화하므로 정합성 유지.

- [ ] **Step 5: page.tsx — 작업자 선택 시 서버 저장(교체)**

`handleWorkerConfirm`(175-178행)을 교체:

```typescript
  const handleWorkerConfirm = useCallback(async (worker: Worker) => {
    setWorker(worker);
    setIsWorkerOpen(false);
    if (selectedEquip) {
      try {
        await api.patch(`/equipment/equips/${selectedEquip.equipCode}/worker`, {
          workerCode: worker.workerCode,
        }, { suppressErrorModal: true });
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? t('kiosk.worker.assignError', '작업자 할당에 실패했습니다.');
        toast.error(msg);
      }
    }
  }, [selectedEquip, setWorker, t]);
```

`addWorker`가 더 이상 page.tsx에서 쓰이지 않으면 구조분해에서 제거(또는 EquipHeader 정리 후 제거).

- [ ] **Step 6: page.tsx — 작업 해제 핸들러 + EquipHeader에 전달**

해제 핸들러 추가(예: `handleSaved` 근처):

```typescript
  // 작업 종료 — 서버 장착 해제 후 화면 초기화(설비는 유지)
  const handleReleaseMount = useCallback(async () => {
    if (!selectedEquip) return;
    try {
      await api.delete(`/equipment/equips/${selectedEquip.equipCode}/mount`, { suppressErrorModal: true });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? t('kiosk.mount.releaseError', '작업 해제에 실패했습니다.');
      toast.error(msg);
    } finally {
      clearMount();
    }
  }, [selectedEquip, clearMount, t]);
```

`EquipHeader`에 prop 전달:

```typescript
      <EquipHeader
        equips={equips}
        onOpenJobOrder={() => setIsJobOrderOpen(true)}
        onOpenWorker={() => setIsWorkerOpen(true)}
        onOpenDailyInspect={() => setIsDailyInspectOpen(true)}
        onOpenWorkerInspect={() => setIsWorkerInspectOpen(true)}
        onReleaseMount={handleReleaseMount}
        dailyInspectAt={dailyInspectAt}
        workerInspectAt={workerInspectAt}
      />
```

- [ ] **Step 7: EquipHeader — 작업 해제 버튼 + 확인 모달**

`EquipHeaderProps`에 `onReleaseMount: () => void;` 추가. 작업자 1:1이므로 작업자 표시는 단일(현 `selectedWorkers.map`이 0~1개라 그대로 동작). 작업지시/작업자가 선택된 경우 "작업 종료" 버튼을 노출. `confirm()` 금지 → 기존 `Modal` 컴포넌트로 확인.

`Cpu` 등 import 옆에 `Power`(lucide) 추가. 상태/모달:

```typescript
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
```

작업자 블록(185행 닫는 `</div>` 직후, 점검 블록 앞)에 버튼 추가:

```typescript
            {(selectedJobOrder || selectedWorkers.length > 0) && (
              <button
                type="button"
                onClick={() => setIsReleaseOpen(true)}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border border-red-300 bg-card px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Power className="h-4 w-4" />
                {t('kiosk.header.releaseMount', '작업 종료')}
              </button>
            )}
```

`EquipSelectModal` 아래에 확인 모달 추가(프로젝트 `Modal` 사용):

```tsx
      <Modal isOpen={isReleaseOpen} onClose={() => setIsReleaseOpen(false)} title={t('kiosk.header.releaseMount', '작업 종료')} size="md">
        <p className="text-sm text-black/70 dark:text-white/70">
          {t('kiosk.mount.releaseConfirm', '이 설비의 작업지시와 작업자 장착을 해제합니다. 계속할까요?')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setIsReleaseOpen(false)}>{t('common.cancel', '취소')}</Button>
          <Button variant="danger" onClick={() => { setIsReleaseOpen(false); onReleaseMount(); }}>
            {t('kiosk.header.releaseMount', '작업 종료')}
          </Button>
        </div>
      </Modal>
```

상단 import에 `import { Modal, Button } from '@/components/ui';`(경로/변형명은 프로젝트 공용 UI에 맞춰 확인 — `variant="danger"`가 없으면 기존 위험 버튼 스타일을 따른다).

- [ ] **Step 8: 구조 테스트 통과 확인**

Run: `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/kiosk-equip-mount-persist.structure.test.mjs`
Expected: PASS 4건. (정규식이 실제 코드와 안 맞으면 코드가 아닌 테스트 정규식을 실제 구현에 맞게 조정)

- [ ] **Step 9: 타입 체크**

Run: `pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 0건.

- [ ] **Step 10: 커밋**

```bash
git add "apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx" "apps/frontend/src/app/(authenticated)/production/input-kiosk/kiosk-equip-mount-persist.structure.test.mjs"
git commit -m "feat(kiosk): 설비 선택 시 서버 mount 복원 + 작업자 서버저장 + 작업 종료 해제"
```

---

## Task 7: i18n + 통합 검증

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

- [ ] **Step 1: 신규 문구 4파일 동시 추가**

각 파일의 `kiosk.header`에 `releaseMount`, `kiosk`에 `mount.releaseConfirm`/`mount.releaseError`, `worker.assignError`를 추가. BOM 절대 금지.

- ko: `releaseMount`="작업 종료", `mount.releaseConfirm`="이 설비의 작업지시와 작업자 장착을 해제합니다. 계속할까요?", `mount.releaseError`="작업 해제에 실패했습니다.", `worker.assignError`="작업자 할당에 실패했습니다."
- en: "End Work" / "This will release the job order and worker mounted on this equipment. Continue?" / "Failed to release work." / "Failed to assign worker."
- zh: "结束作业" / "将解除此设备装载的工单和作业员。是否继续？" / "解除作业失败。" / "分配作业员失败。"
- vi: "Kết thúc công việc" / "Thao tác này sẽ gỡ lệnh sản xuất và công nhân khỏi thiết bị. Tiếp tục?" / "Gỡ công việc thất bại." / "Gán công nhân thất bại."

- [ ] **Step 2: JSON 유효성 + 키 존재 확인**

Run(Grep): 각 로케일에 `releaseMount` 키 존재 확인. JSON 파싱 오류 없음.
Run: `pnpm --filter @harness/frontend exec tsc --noEmit` (0건)

- [ ] **Step 3: 로컬 3002 브라우저 E2E 검증**

dev 서버 실행 중 가정(빌드 금지). `/production/input-kiosk`에서:
1. 설비 A 선택 → 작업지시·작업자 지정 → **새로고침** → 동일 복원 확인.
2. 다른 브라우저(시크릿창, localStorage 비어있음)에서 설비 A 선택 → 작업지시·작업자 그대로 표시.
3. 작업자 변경 → JSHANES `SELECT CURRENT_WORKER_ID FROM EQUIP_MASTERS WHERE EQUIP_CODE='A'` 갱신 확인.
4. "작업 종료" → 확인 모달 → `CURRENT_JOB_ORDER_ID`/`CURRENT_WORKER_ID` 둘 다 null 확인.
5. 작업지시 `complete`(DONE) → 해당 설비 두 컬럼 자동 null 확인.

- [ ] **Step 4: 테스트 데이터 원복**

검증에 사용한 설비 mount/작업지시 상태를 원복(테스트 전 값으로).

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "i18n(kiosk): 작업 종료/해제 문구 추가 (ko/en/zh/vi)"
```

- [ ] **Step 6: 협업 보드 마무리** — `LOCKS.md` lock 해제, `JOURNAL.md`에 검증 내역 기록, `HANDOFF/claude.md` 갱신.

---

## Self-Review 메모

- **Spec 커버리지**: 서버 복원(Task6 Step4) / 작업자 DB 저장(Task1,2,6) / 수동 해제(Task2,6,7) / DONE 자동 해제(Task3) / localStorage 의존 제거(Task5 partialize) — 모두 매핑됨.
- **타입 일관성**: `getMount`→`{orderNo, workerCode}`, `assignWorker({workerCode})`, `clearMount`, `setWorker(Worker|null)`, `mapJobOrderRow`→`JobOrder` — Task 전반 동일 시그니처 사용.
- **범위 밖 유지**: interlock/자재·소모품 스캔/진행수량 동기화 로직 미변경(복원 후 기존 서버 재확인 effect가 처리).
- **주의**: 백엔드 spec의 생성자 모킹은 실제 `EquipMasterService` 주입 순서/`findById` 내부에 맞춰 조정 필요(서비스 본문 확인). 프론트 `Modal`/`Button` import 경로·변형은 공용 UI 실제 export에 맞춘다.
